"use server";

/**
 * Test email connection for a specific provider
 */
export async function testEmailConnection(provider: "gmail" | "outlook") {
    try {
        const result = {
            configured: false,
            connected: false,
            emailCount: 0,
            error: null as string | null,
            provider,
        };

        if (provider === "gmail") {
            if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET || !process.env.GMAIL_REFRESH_TOKEN) {
                result.configured = false;
                result.error = "Gmail credentials not configured in .env file";
                return { success: false, result };
            }

            result.configured = true;
            try {
                const { google } = await import('googleapis');
                const oauth2Client = new google.auth.OAuth2(
                    process.env.GMAIL_CLIENT_ID,
                    process.env.GMAIL_CLIENT_SECRET,
                    process.env.GMAIL_REDIRECT_URI || 'http://localhost:8080/'
                );
                oauth2Client.setCredentials({
                    refresh_token: process.env.GMAIL_REFRESH_TOKEN
                });
                
                const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
                const response = await gmail.users.messages.list({
                    userId: 'me',
                    maxResults: 10,
                    q: 'is:unread'
                });
                
                result.connected = true;
                result.emailCount = response.data.messages?.length || 0;
            } catch (error: any) {
                result.connected = false;
                if (error.code === 401 || error.message?.includes('invalid_client')) {
                    result.error = "Authentication failed: Invalid OAuth credentials. Check CLIENT_ID, CLIENT_SECRET, and REFRESH_TOKEN in .env file.";
                } else if (error.code === 403) {
                    result.error = "Access denied: Gmail API not enabled or insufficient permissions. Enable Gmail API in Google Cloud Console.";
                } else {
                    result.error = error.message || "Connection failed";
                }
                console.error("Gmail connection error:", error);
            }
        } else if (provider === "outlook") {
            if (!process.env.OUTLOOK_USER || !process.env.OUTLOOK_PASSWORD) {
                result.configured = false;
                result.error = "Outlook credentials not configured in .env file";
                return { success: false, result };
            }

            result.configured = true;
            try {
                const Imap = (await import('imap')).default;
                
                const emailCount = await Promise.race([
                    new Promise<number>((resolve, reject) => {
                        const imap = new Imap({
                            user: process.env.OUTLOOK_USER || '',
                            password: process.env.OUTLOOK_PASSWORD || '',
                            host: process.env.OUTLOOK_HOST || 'outlook.office365.com',
                            port: parseInt(process.env.OUTLOOK_PORT || '993'),
                            tls: true,
                            tlsOptions: { rejectUnauthorized: false },
                            connTimeout: 10000, // 10 seconds connection timeout
                            authTimeout: 10000,  // 10 seconds auth timeout
                        } as any);
                        
                        let resolved = false;
                        
                        const cleanup = () => {
                            if (!resolved) {
                                resolved = true;
                                try {
                                    imap.end();
                                } catch (e) {
                                    // Ignore cleanup errors
                                }
                            }
                        };
                        
                        imap.once('ready', () => {
                            imap.openBox('INBOX', false, (err: any, box: any) => {
                                if (err) {
                                    cleanup();
                                    reject(err);
                                    return;
                                }
                                
                                imap.search(['UNSEEN'], (err: any, searchResults: any) => {
                                    cleanup();
                                    if (err) {
                                        reject(err);
                                        return;
                                    }
                                    resolve(searchResults?.length || 0);
                                });
                            });
                        });
                        
                        imap.once('error', (err: any) => {
                            cleanup();
                            reject(err);
                        });
                        
                        imap.connect();
                    }),
                    new Promise<number>((_, reject) => {
                        setTimeout(() => reject(new Error('Connection timeout after 15 seconds')), 15000);
                    })
                ]);
                
                result.connected = true;
                result.emailCount = emailCount;
            } catch (error: any) {
                result.connected = false;
                if (error.source === 'authentication' || error.message?.includes('LOGIN failed')) {
                    result.error = "Authentication failed:\n• Use App Password (not regular password)\n• Enable IMAP in Outlook settings\n• Enable 2FA (required for app passwords)";
                } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
                    result.error = `Connection failed: Check OUTLOOK_HOST (${process.env.OUTLOOK_HOST || 'outlook.office365.com'}) and OUTLOOK_PORT (${process.env.OUTLOOK_PORT || '993'})`;
                } else {
                    result.error = error.message || error.textCode || "Connection failed";
                }
                console.error("Outlook connection error:", error);
            }
        }

        return {
            success: result.connected,
            result,
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || "Failed to test email connection",
            result: null,
        };
    }
}

/**
 * Process emails from a specific provider
 */
export async function processEmailsFromProvider(provider: "gmail" | "outlook") {
    try {
        const { fetchEmails, getEmailContent } = await import("@/lib/email-service");
        const { analyzeEmail, matchTransactionToCard } = await import("@/lib/llm-service");
        const { createDraftTransaction } = await import("./draft-transaction-actions");
        const { createOffer } = await import("./offer-actions");
        const { getCards } = await import("./card-actions");
        const { prisma } = await import("@/lib/prisma");
        const { revalidatePath } = await import("next/cache");

        // Get all cards for matching
        const cards = await getCards();

        // Get already processed email IDs
        const processedEmails = await prisma.processedEmail.findMany({
            select: { emailId: true },
        });
        const processedEmailIds = new Set(processedEmails.map(e => e.emailId));

        // Fetch emails from specific provider
        let emails;
        if (provider === "gmail") {
            const { google } = await import('googleapis');
                const oauth2Client = new google.auth.OAuth2(
                    process.env.GMAIL_CLIENT_ID,
                    process.env.GMAIL_CLIENT_SECRET,
                    process.env.GMAIL_REDIRECT_URI || 'http://localhost:8080/'
                );
            oauth2Client.setCredentials({
                refresh_token: process.env.GMAIL_REFRESH_TOKEN
            });
            
            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
            const response = await gmail.users.messages.list({
                userId: 'me',
                maxResults: 50,
                q: 'from:noreply@bank.com OR from:offers@bank.com OR from:alerts@bank.com OR is:unread'
            });
            
            const messages = response.data.messages || [];
            emails = [];
            
            for (const message of messages.slice(0, 50)) {
                try {
                    const msg = await gmail.users.messages.get({
                        userId: 'me',
                        id: message.id!,
                        format: 'full'
                    });
                    
                    const payload = msg.data.payload;
                    const headers = payload?.headers || [];
                    const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
                    const from = headers.find((h: any) => h.name === 'From')?.value || '';
                    const date = new Date(parseInt(msg.data.internalDate || '0'));
                    
                    let body = '';
                    const extractBody = (part: any): string => {
                        if (part.body?.data) {
                            return Buffer.from(part.body.data, 'base64').toString();
                        }
                        if (part.parts) {
                            for (const subPart of part.parts) {
                                const extracted = extractBody(subPart);
                                if (extracted && (subPart.mimeType === 'text/plain' || !body)) {
                                    body = extracted;
                                }
                            }
                        }
                        return body;
                    };
                    
                    body = extractBody(payload);
                    if (!body && payload?.body?.data) {
                        body = Buffer.from(payload.body.data, 'base64').toString();
                    }
                    
                    emails.push({
                        id: message.id!,
                        subject,
                        body: body || subject,
                        from,
                        date,
                        provider: 'gmail'
                    });
                } catch (err) {
                    console.error(`Error fetching Gmail message ${message.id}:`, err);
                }
            }
        } else {
            // Outlook
            const Imap = (await import('imap')).default;
            const { simpleParser } = await import('mailparser');
            
            emails = await new Promise<any[]>((resolve, reject) => {
                const imap = new Imap({
                    user: process.env.OUTLOOK_USER || '',
                    password: process.env.OUTLOOK_PASSWORD || '',
                    host: process.env.OUTLOOK_HOST || 'outlook.office365.com',
                    port: parseInt(process.env.OUTLOOK_PORT || '993'),
                    tls: true,
                    tlsOptions: { rejectUnauthorized: false }
                } as any);
                
                const emailList: any[] = [];
                let messageCount = 0;
                
                imap.once('ready', () => {
                    imap.openBox('INBOX', false, (err: any, box: any) => {
                        if (err) {
                            imap.end();
                            reject(err);
                            return;
                        }
                        
                        imap.search(['UNSEEN'], (err: any, results: any) => {
                            if (err) {
                                imap.end();
                                reject(err);
                                return;
                            }
                            
                            if (!results || results.length === 0) {
                                imap.end();
                                resolve([]);
                                return;
                            }
                            
                            const fetch = imap.fetch(results.slice(0, 50), {
                                bodies: '',
                                struct: true
                            });
                            
                            fetch.on('message', (msg: any) => {
                                msg.on('body', (stream: any) => {
                                    simpleParser(stream, (err: any, parsed: any) => {
                                        if (!err && parsed) {
                                            const fromEmail = parsed.from?.value?.[0]?.address || parsed.from?.text || '';
                                            emailList.push({
                                                id: parsed.messageId || `outlook-${Date.now()}-${messageCount++}`,
                                                subject: parsed.subject || '',
                                                body: parsed.text || parsed.htmlAsText || parsed.html || '',
                                                from: fromEmail,
                                                date: parsed.date || new Date(),
                                                provider: 'outlook'
                                            });
                                            
                                            if (emailList.length >= 50) {
                                                imap.end();
                                                resolve(emailList);
                                            }
                                        }
                                    });
                                });
                            });
                            
                            fetch.once('end', () => {
                                imap.end();
                                resolve(emailList);
                            });
                            
                            fetch.once('error', (err: any) => {
                                imap.end();
                                reject(err);
                            });
                        });
                    });
                });
                
                imap.once('error', (err: any) => {
                    reject(err);
                });
                
                imap.connect();
            });
        }

        let transactionCount = 0;
        let offerCount = 0;
        const errors: string[] = [];

        for (const email of emails) {
            if (processedEmailIds.has(email.id)) {
                continue;
            }

            try {
                const emailBody = email.body || await getEmailContent(email.id, email.provider);

                const analysis = await analyzeEmail(
                    email.subject,
                    emailBody,
                    Array.from(processedEmailIds),
                    cards.map(c => ({ id: c.id, name: c.name, last4: c.last4, bank: c.bank }))
                );

                for (const transaction of analysis.transactions) {
                    const cardId = await matchTransactionToCard(transaction, cards);
                    
                    await createDraftTransaction({
                        emailId: email.id,
                        cardId: cardId || undefined,
                        merchant: transaction.merchant,
                        amount: transaction.amount,
                        category: transaction.category,
                        subCategory: transaction.subCategory,
                        description: transaction.description,
                        date: new Date(transaction.date),
                        transactionType: "expense",
                        emailSubject: email.subject,
                        emailBody: emailBody,
                        originalData: JSON.stringify(transaction),
                    });
                    transactionCount++;
                }

                for (const offer of analysis.offers) {
                    const cardId = cards.find(c => c.last4 === offer.cardLast4)?.id;

                    // Validate and parse dates safely
                    let startDate: Date;
                    let endDate: Date;
                    
                    try {
                        startDate = offer.startDate ? new Date(offer.startDate) : new Date();
                        if (isNaN(startDate.getTime())) {
                            startDate = new Date(); // Default to today if invalid
                        }
                    } catch {
                        startDate = new Date(); // Default to today if parsing fails
                    }

                    try {
                        endDate = offer.endDate ? new Date(offer.endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                        if (isNaN(endDate.getTime())) {
                            endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default to 30 days from now
                        }
                    } catch {
                        endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default to 30 days from now
                    }

                    // Extract sender email from "from" field
                    let senderEmail: string | undefined;
                    if (email.from) {
                        // Extract email from "Name <email@domain.com>" or just "email@domain.com"
                        const emailMatch = email.from.match(/<([^>]+)>/) || email.from.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
                        senderEmail = emailMatch ? emailMatch[1] : email.from;
                    }

                    const result = await createOffer({
                        emailId: email.id,
                        title: offer.title,
                        description: offer.description,
                        cardId: cardId || undefined,
                        discountAmount: offer.discountAmount,
                        discountPercent: offer.discountPercent,
                        minSpend: offer.minSpend,
                        maxDiscount: offer.maxDiscount,
                        startDate,
                        endDate,
                        terms: offer.terms,
                        category: offer.category,
                        senderEmail,
                        emailSubject: email.subject,
                        emailBody: emailBody,
                    });

                    // Only increment if offer was actually created (not skipped)
                    if (result.success && !result.skipped) {
                        offerCount++;
                    }
                }

                await prisma.processedEmail.create({
                    data: {
                        emailId: email.id,
                        emailSubject: email.subject,
                        transactionCount: analysis.transactions.length,
                        offerCount: analysis.offers.length,
                        status: "processed",
                    },
                });
            } catch (error: any) {
                errors.push(`Error processing email ${email.id}: ${error.message}`);
                
                await prisma.processedEmail.create({
                    data: {
                        emailId: email.id,
                        emailSubject: email.subject,
                        status: "failed",
                        errorMessage: error.message,
                    },
                });
            }
        }

        revalidatePath("/drafts");
        revalidatePath("/offers");

        return {
            success: true,
            processed: emails.length,
            transactions: transactionCount,
            offers: offerCount,
            errors: errors.length > 0 ? errors : undefined,
        };
    } catch (error: any) {
        console.error(`Error processing ${provider} emails:`, error);
        return {
            success: false,
            error: error.message || `Failed to process ${provider} emails`,
        };
    }
}
