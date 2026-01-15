"use server";

/**
 * Email Service
 * Supports both Gmail API and Outlook/IMAP
 */

export interface EmailAttachment {
    filename: string;
    mimeType: string;
    size?: number;
    attachmentId?: string; // Gmail attachment ID
    content?: Buffer; // For Outlook, content is available directly
}

export interface EmailMessage {
    id: string;
    subject: string;
    body: string;
    from: string;
    date: Date;
    threadId?: string;
    provider: "gmail" | "outlook";
    attachments?: EmailAttachment[];
}

export interface EmailProvider {
    fetchEmails(maxResults: number, query?: string, startDate?: Date, endDate?: Date): Promise<EmailMessage[]>;
    getEmailContent(messageId: string): Promise<string>;
    getAttachment(messageId: string, attachmentId: string): Promise<Buffer>;
}

/**
 * Gmail API Implementation
 */
class GmailProvider implements EmailProvider {
    async fetchEmails(maxResults: number = 50, query?: string, startDate?: Date, endDate?: Date): Promise<EmailMessage[]> {
        try {
            if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET || !process.env.GMAIL_REFRESH_TOKEN) {
                console.warn("Gmail credentials not configured");
                return [];
            }

            // Dynamic import - only if package is installed
            let google;
            try {
                const googleapisModule = await import('googleapis');
                google = googleapisModule.google || googleapisModule;
            } catch (importError) {
                console.error("Googleapis package not installed. Run: npm install googleapis");
                return [];
            }
            
            const oauth2Client = new google.auth.OAuth2(
                process.env.GMAIL_CLIENT_ID,
                process.env.GMAIL_CLIENT_SECRET,
                process.env.GMAIL_REDIRECT_URI || 'http://localhost:8080/'
            );
            
            oauth2Client.setCredentials({
                refresh_token: process.env.GMAIL_REFRESH_TOKEN
            });
            
            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
            
            // Build query with date filters
            // Gmail uses format: after:YYYY/MM/DD or before:YYYY/MM/DD
            // Use very broad query to catch all financial emails, including forwarded ones
            let gmailQuery = query || 'transaction OR payment OR debit OR credit OR purchase OR offer OR discount OR "amount" OR "balance" OR "statement"';
            if (startDate) {
                const year = startDate.getFullYear();
                const month = String(startDate.getMonth() + 1).padStart(2, '0');
                const day = String(startDate.getDate()).padStart(2, '0');
                gmailQuery += ` after:${year}/${month}/${day}`;
            }
            if (endDate) {
                const year = endDate.getFullYear();
                const month = String(endDate.getMonth() + 1).padStart(2, '0');
                const day = String(endDate.getDate()).padStart(2, '0');
                gmailQuery += ` before:${year}/${month}/${day}`;
            }
            
            const response = await gmail.users.messages.list({
                userId: 'me',
                maxResults,
                q: gmailQuery
            });
            
            const messages = response.data.messages || [];
            const emails: EmailMessage[] = [];
            
            for (const message of messages.slice(0, maxResults)) {
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
                    
                    // Extract body - handle multipart messages
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
                        return '';
                    };
                    
                    body = extractBody(payload);
                    if (!body && payload?.body?.data) {
                        body = Buffer.from(payload.body.data, 'base64').toString();
                    }
                    
                    // Extract attachments
                    const attachments: EmailAttachment[] = [];
                    const extractAttachments = (part: any) => {
                        if (part.filename && part.body?.attachmentId) {
                            attachments.push({
                                filename: part.filename,
                                mimeType: part.mimeType || 'application/octet-stream',
                                size: part.body.size,
                                attachmentId: part.body.attachmentId,
                            });
                        }
                        if (part.parts) {
                            for (const subPart of part.parts) {
                                extractAttachments(subPart);
                            }
                        }
                    };
                    extractAttachments(payload);
                    
                    emails.push({
                        id: message.id!,
                        subject,
                        body: body || subject, // Fallback to subject if no body
                        from,
                        date,
                        threadId: msg.data.threadId || undefined,
                        provider: 'gmail',
                        attachments: attachments.length > 0 ? attachments : undefined
                    });
                } catch (err) {
                    console.error(`Error fetching Gmail message ${message.id}:`, err);
                }
            }
            
            return emails;
        } catch (error: any) {
            console.error("Error fetching Gmail emails:", error);
            // Re-throw with more context for better error messages
            if (error.code === 401 || error.message?.includes('invalid_client')) {
                throw new Error("Gmail authentication failed. Please check your Gmail OAuth credentials (CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN) in .env file.");
            }
            if (error.code === 403) {
                throw new Error("Gmail API access denied. Please ensure Gmail API is enabled and OAuth scopes are correct.");
            }
            throw new Error(`Gmail error: ${error.message || 'Unknown error'}`);
        }
    }

    async getEmailContent(messageId: string): Promise<string> {
        try {
            if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET || !process.env.GMAIL_REFRESH_TOKEN) {
                return "";
            }

            // Dynamic import - only if package is installed
            let google;
            try {
                const googleapisModule = await import('googleapis');
                google = googleapisModule.google || googleapisModule;
            } catch (importError) {
                console.error("Googleapis package not installed. Run: npm install googleapis");
                return "";
            }
            
            const oauth2Client = new google.auth.OAuth2(
                process.env.GMAIL_CLIENT_ID,
                process.env.GMAIL_CLIENT_SECRET,
                process.env.GMAIL_REDIRECT_URI || 'http://localhost:8080/'
            );
            
            oauth2Client.setCredentials({
                refresh_token: process.env.GMAIL_REFRESH_TOKEN
            });
            
            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
            const msg = await gmail.users.messages.get({
                userId: 'me',
                id: messageId,
                format: 'full'
            });
            
            const payload = msg.data.payload;
            let body = '';
            
            const extractBody = (part: any): string => {
                if (!part) return '';
                if (part.body?.data) {
                    return Buffer.from(part.body.data, 'base64').toString();
                }
                if (part.parts) {
                    for (const subPart of part.parts) {
                        const extracted = extractBody(subPart);
                        if (extracted) {
                            if (subPart.mimeType === 'text/plain') {
                                return extracted;
                            } else if (subPart.mimeType === 'text/html' && !body) {
                                body = extracted;
                            }
                        }
                    }
                }
                return body;
            };
            
            body = extractBody(payload);
            if (!body && payload?.body?.data) {
                body = Buffer.from(payload.body.data, 'base64').toString();
            }
            
            return body;
        } catch (error) {
            console.error("Error fetching Gmail email content:", error);
            return "";
        }
    }

    async getAttachment(messageId: string, attachmentId: string): Promise<Buffer> {
        try {
            if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET || !process.env.GMAIL_REFRESH_TOKEN) {
                throw new Error("Gmail credentials not configured");
            }

            let google;
            try {
                const googleapisModule = await import('googleapis');
                google = googleapisModule.google || googleapisModule;
            } catch (importError) {
                throw new Error("Googleapis package not installed");
            }
            
            const oauth2Client = new google.auth.OAuth2(
                process.env.GMAIL_CLIENT_ID,
                process.env.GMAIL_CLIENT_SECRET,
                process.env.GMAIL_REDIRECT_URI || 'http://localhost:8080/'
            );
            
            oauth2Client.setCredentials({
                refresh_token: process.env.GMAIL_REFRESH_TOKEN
            });
            
            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
            const response = await gmail.users.messages.attachments.get({
                userId: 'me',
                messageId: messageId,
                id: attachmentId
            });
            
            if (response.data.data) {
                return Buffer.from(response.data.data, 'base64');
            }
            throw new Error("No attachment data received");
        } catch (error) {
            console.error("Error fetching Gmail attachment:", error);
            throw error;
        }
    }
}

/**
 * Outlook/IMAP Implementation
 */
class OutlookProvider implements EmailProvider {
    async fetchEmails(maxResults: number = 50, query?: string, startDate?: Date, endDate?: Date): Promise<EmailMessage[]> {
        try {
            if (!process.env.OUTLOOK_USER || !process.env.OUTLOOK_PASSWORD) {
                console.warn("Outlook credentials not configured");
                return [];
            }

            // Dynamic import - only if package is installed
            let Imap, simpleParser;
            try {
                const imapModule = await import('imap');
                Imap = imapModule.default || imapModule;
                const mailparserModule = await import('mailparser');
                simpleParser = mailparserModule.simpleParser || mailparserModule;
            } catch (importError) {
                console.error("IMAP packages not installed. Run: npm install imap mailparser");
                return [];
            }
            
            return new Promise((resolve, reject) => {
                const imap = new Imap({
                    user: process.env.OUTLOOK_USER || '',
                    password: process.env.OUTLOOK_PASSWORD || '',
                    host: process.env.OUTLOOK_HOST || 'outlook.office365.com',
                    port: parseInt(process.env.OUTLOOK_PORT || '993'),
                    tls: true,
                    tlsOptions: { rejectUnauthorized: false }
                } as any);
                
                const emails: EmailMessage[] = [];
                let messageCount = 0;
                
                imap.once('ready', () => {
                    imap.openBox('INBOX', false, (err: any, box: any) => {
                        if (err) {
                            imap.end();
                            reject(err);
                            return;
                        }
                        
                        // Search for unread emails with date filters
                        // Note: IMAP search is limited, so we fetch all unread and filter later
                        const searchCriteria: any[] = ['UNSEEN'];
                        if (startDate) {
                            searchCriteria.push(['SINCE', startDate]);
                        }
                        if (endDate) {
                            // IMAP doesn't have a direct BEFORE, so we'll filter after fetching
                            // For now, we'll use ON or SENTON for exact date matching
                            // We'll filter by date after fetching
                        }
                        
                        imap.search(searchCriteria, (err: any, results: any) => {
                            if (err) {
                                imap.end();
                                reject(err);
                                return;
                            }
                            
                            if (!results || results.length === 0) {
                                imap.end();
                                resolve(emails);
                                return;
                            }
                            
                            const fetch = imap.fetch(results.slice(0, maxResults), {
                                bodies: '',
                                struct: true
                            });
                            
                            fetch.on('message', (msg: any, seqno: number) => {
                                msg.on('body', (stream: any) => {
                                    simpleParser(stream, (err: any, parsed: any) => {
                                        if (!err && parsed) {
                                            const emailDate = parsed.date || new Date();
                                            
                                            // Filter by date range
                                            if (startDate && emailDate < startDate) {
                                                return; // Skip emails before startDate
                                            }
                                            if (endDate && emailDate > endDate) {
                                                return; // Skip emails after endDate
                                            }
                                            
                                            // Very broad filtering - accept all emails if query is provided
                                            // This allows forwarded emails and any financial emails to be processed
                                            const fromEmail = parsed.from?.value?.[0]?.address || parsed.from?.text || '';
                                            const subject = parsed.subject || '';
                                            const textContent = parsed.text || parsed.htmlAsText || '';
                                            
                                            // Accept email if:
                                            // 1. No query (process all)
                                            // 2. Query provided and email contains financial keywords
                                            const hasFinancialKeywords = !query || 
                                                fromEmail.toLowerCase().includes('bank') || 
                                                fromEmail.toLowerCase().includes('card') ||
                                                fromEmail.toLowerCase().includes('noreply') ||
                                                fromEmail.toLowerCase().includes('alerts') ||
                                                fromEmail.toLowerCase().includes('offers') ||
                                                subject.toLowerCase().includes('transaction') ||
                                                subject.toLowerCase().includes('payment') ||
                                                subject.toLowerCase().includes('debit') ||
                                                subject.toLowerCase().includes('credit') ||
                                                subject.toLowerCase().includes('purchase') ||
                                                subject.toLowerCase().includes('offer') ||
                                                subject.toLowerCase().includes('statement') ||
                                                textContent.toLowerCase().includes('transaction') ||
                                                textContent.toLowerCase().includes('amount') ||
                                                textContent.toLowerCase().includes('balance');
                                            
                                            if (hasFinancialKeywords) {
                                                
                                                // Extract attachments
                                                const attachments: EmailAttachment[] = [];
                                                if (parsed.attachments) {
                                                    for (const att of parsed.attachments) {
                                                        attachments.push({
                                                            filename: att.filename || 'attachment',
                                                            mimeType: att.contentType || 'application/octet-stream',
                                                            size: att.size,
                                                            content: att.content ? Buffer.from(att.content) : undefined
                                                        });
                                                    }
                                                }
                                                
                                                emails.push({
                                                    id: parsed.messageId || `outlook-${Date.now()}-${messageCount++}`,
                                                    subject: parsed.subject || '',
                                                    body: parsed.text || parsed.htmlAsText || parsed.html || '',
                                                    from: fromEmail,
                                                    date: emailDate,
                                                    provider: 'outlook',
                                                    attachments: attachments.length > 0 ? attachments : undefined
                                                });
                                            }
                                            
                                            if (emails.length >= maxResults) {
                                                imap.end();
                                                resolve(emails);
                                            }
                                        }
                                    });
                                });
                            });
                            
                            fetch.once('end', () => {
                                imap.end();
                                resolve(emails);
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
        } catch (error) {
            console.error("Error fetching Outlook emails:", error);
            return [];
        }
    }

    async getEmailContent(messageId: string): Promise<string> {
        // For IMAP, we already have the full content in fetchEmails
        // This would need to fetch again if called separately
        // For now, return empty - content should be stored when email is first fetched
        return "";
    }

    async getAttachment(messageId: string, attachmentId: string): Promise<Buffer> {
        // For Outlook/IMAP, attachments are already included in the email message
        // This method is not typically needed, but we'll throw an error to indicate
        // that attachments should be accessed from the email message directly
        throw new Error("Outlook attachments are included in email message. Access from email.attachments");
    }
}

/**
 * Fetch emails from a specific provider or all configured providers
 */
export async function fetchEmails(
    maxResults: number = 50,
    query?: string,
    startDate?: Date,
    endDate?: Date,
    provider?: "gmail" | "outlook" | "all"
): Promise<EmailMessage[]> {
    const emails: EmailMessage[] = [];
    const targetProvider = provider || "all";
    
    // Fetch from Gmail if configured and requested
    if (targetProvider === "all" || targetProvider === "gmail") {
        if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN) {
            try {
                const gmailProvider = new GmailProvider();
                const gmailEmails = await gmailProvider.fetchEmails(maxResults, query, startDate, endDate);
                emails.push(...gmailEmails);
            } catch (error: any) {
                console.error("Error fetching from Gmail:", error);
                // Don't throw here - allow Outlook to still work if Gmail fails
                // The error will be caught and shown in the test connection
            }
        }
    }
    
    // Fetch from Outlook if configured and requested
    if (targetProvider === "all" || targetProvider === "outlook") {
        if (process.env.OUTLOOK_USER && process.env.OUTLOOK_PASSWORD) {
            try {
                const outlookProvider = new OutlookProvider();
                const outlookEmails = await outlookProvider.fetchEmails(maxResults, query, startDate, endDate);
                emails.push(...outlookEmails);
            } catch (error: any) {
                console.error("Error fetching from Outlook:", error);
                // Don't throw here - allow Gmail to still work if Outlook fails
                // The error will be caught and shown in the test connection
            }
        }
    }
    
    // Sort by date (newest first) and limit results
    return emails
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, maxResults);
}

export async function getEmailContent(messageId: string, provider: "gmail" | "outlook"): Promise<string> {
    try {
        if (provider === "gmail") {
            const gmailProvider = new GmailProvider();
            return await gmailProvider.getEmailContent(messageId);
        } else {
            const outlookProvider = new OutlookProvider();
            return await outlookProvider.getEmailContent(messageId);
        }
    } catch (error) {
        console.error(`Error fetching email content from ${provider}:`, error);
        return "";
    }
}

export async function getAttachment(messageId: string, attachmentId: string, provider: "gmail" | "outlook"): Promise<Buffer> {
    try {
        if (provider === "gmail") {
            const gmailProvider = new GmailProvider();
            return await gmailProvider.getAttachment(messageId, attachmentId);
        } else {
            // For Outlook, attachments should be accessed from email message
            throw new Error("Outlook attachments are included in email message");
        }
    } catch (error) {
        console.error(`Error fetching attachment from ${provider}:`, error);
        throw error;
    }
}
