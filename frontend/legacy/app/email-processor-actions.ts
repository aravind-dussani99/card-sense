"use server";

import { prisma } from "@/lib/prisma";
import { fetchEmails, getEmailContent } from "@/lib/email-service";
import { analyzeEmail, matchTransactionToCard } from "@/lib/llm-service";
import { createDraftTransaction } from "./draft-transaction-actions";
import { createOffer } from "./offer-actions";
import { getCards } from "./card-actions";
import { revalidatePath } from "next/cache";

/**
 * Get all processed emails for debugging/testing
 */
export async function getProcessedEmails(limit: number = 100) {
    try {
        const processedEmails = await prisma.processedEmail.findMany({
            orderBy: { processedAt: "desc" },
            take: limit,
            select: {
                id: true,
                emailId: true,
                emailSubject: true,
                originalDate: true,
                processedAt: true,
                transactionCount: true,
                offerCount: true,
                status: true,
                errorMessage: true,
                emailBody: true,
            },
        });
        return processedEmails;
    } catch (error) {
        console.error("Error fetching processed emails:", error);
        return [];
    }
}

/**
 * Process emails and extract transactions/offers
 * This function:
 * 1. Fetches unprocessed emails
 * 2. Analyzes them with LLM
 * 3. Creates draft transactions and offers
 * 4. Marks emails as processed
 */
export async function processEmails() {
    try {
        // Get all cards for matching
        const cards = await getCards();

        // Get already processed email IDs
        const processedEmails = await prisma.processedEmail.findMany({
            select: { emailId: true },
        });
        const processedEmailIds = new Set(processedEmails.map(e => e.emailId));

        // Fetch new emails
        // Note: For Outlook, the query parameter is ignored and all unread emails are fetched
        // The filtering happens in the OutlookProvider based on email content
        const emails = await fetchEmails(50, 'from:noreply@bank.com OR from:offers@bank.com OR from:alerts@bank.com');
        
        console.log(`[Email Processor] Fetched ${emails.length} emails total`);
        console.log(`[Email Processor] Gmail: ${emails.filter(e => e.provider === 'gmail').length}, Outlook: ${emails.filter(e => e.provider === 'outlook').length}`);

        let transactionCount = 0;
        let offerCount = 0;
        const errors: string[] = [];

        for (const email of emails) {
            // Skip if already processed
            if (processedEmailIds.has(email.id)) {
                continue;
            }

            try {
                // Get full email content (if not already in email.body)
                let emailBody = email.body;
                if (!emailBody || emailBody.trim().length === 0) {
                    emailBody = await getEmailContent(email.id, email.provider);
                }

                // Analyze email with LLM
                const analysis = await analyzeEmail(
                    email.subject,
                    emailBody,
                    Array.from(processedEmailIds),
                    cards.map(c => ({ id: c.id, name: c.name, last4: c.last4, bank: c.bank }))
                );

                // Create draft transactions
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

                // Create offers
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
                        emailSubject: email.subject,
                        emailBody: emailBody,
                    });

                    // Only increment if offer was actually created (not skipped)
                    if (result.success && !result.skipped) {
                        offerCount++;
                    }
                }

                // Mark email as processed
                await prisma.processedEmail.create({
                    data: {
                        emailId: email.id,
                        emailSubject: email.subject,
                        originalDate: email.date,
                        emailBody: emailBody?.substring(0, 10000) || null,
                        transactionCount: analysis.transactions.length,
                        offerCount: analysis.offers.length,
                        status: "processed",
                    },
                });
            } catch (error: any) {
                errors.push(`Error processing email ${email.id}: ${error.message}`);
                
                // Mark as failed - use upsert to handle case where email already exists
                await prisma.processedEmail.upsert({
                    where: { emailId: email.id },
                    update: {
                        emailSubject: email.subject,
                        originalDate: email.date,
                        emailBody: emailBody?.substring(0, 10000) || null,
                        status: "failed",
                        errorMessage: error.message,
                    },
                    create: {
                        emailId: email.id,
                        emailSubject: email.subject,
                        originalDate: email.date,
                        emailBody: emailBody?.substring(0, 10000) || null,
                        status: "failed",
                        errorMessage: error.message,
                    },
                });
            }
        }

        // Archive expired offers
        await prisma.offer.updateMany({
            where: {
                status: "active",
                endDate: { lt: new Date() },
            },
            data: {
                status: "archived",
            },
        });

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
        console.error("Error processing emails:", error);
        return {
            success: false,
            error: error.message || "Failed to process emails",
        };
    }
}

/**
 * Get processing statistics
 */
export async function getProcessingStats() {
    try {
        const [pendingDrafts, activeOffers, processedEmails] = await Promise.all([
            prisma.draftTransaction.count({ where: { status: "pending" } }),
            prisma.offer.count({ where: { status: "active", endDate: { gte: new Date() } } }),
            prisma.processedEmail.count({ where: { status: "processed" } }),
        ]);

        return {
            pendingDrafts,
            activeOffers,
            processedEmails,
        };
    } catch (error) {
        console.error("Error getting processing stats:", error);
        return {
            pendingDrafts: 0,
            activeOffers: 0,
            processedEmails: 0,
        };
    }
}

/**
 * Get processing history with date ranges and gaps
 */
export async function getProcessingHistory() {
    try {
        const processedEmails = await prisma.processedEmail.findMany({
            where: { status: "processed" },
            orderBy: { processedAt: "asc" },
            select: {
                processedAt: true,
            },
        });

        const totalProcessed = processedEmails.length;
        
        if (totalProcessed === 0) {
            return {
                dateRanges: [],
                lastProcessedDate: null,
                gaps: [],
                totalProcessed: 0,
            };
        }

        // Group processed emails by date (ignoring time)
        const datesByDay = new Map<string, number>();
        for (const email of processedEmails) {
            const dateKey = email.processedAt.toISOString().split('T')[0]; // YYYY-MM-DD
            datesByDay.set(dateKey, (datesByDay.get(dateKey) || 0) + 1);
        }

        // Find date ranges (consecutive days with processing)
        const sortedDates = Array.from(datesByDay.keys()).sort();
        const dateRanges: Array<{ start: string; end: string; count: number }> = [];
        
        if (sortedDates.length > 0) {
            let rangeStart = sortedDates[0];
            let rangeEnd = sortedDates[0];
            let rangeCount = datesByDay.get(rangeStart) || 0;

            for (let i = 1; i < sortedDates.length; i++) {
                const currentDate = sortedDates[i];
                const prevDate = sortedDates[i - 1];
                const prevDateObj = new Date(prevDate);
                const currentDateObj = new Date(currentDate);
                
                // Check if dates are consecutive (within 1 day)
                const daysDiff = (currentDateObj.getTime() - prevDateObj.getTime()) / (1000 * 60 * 60 * 24);
                
                if (daysDiff <= 1) {
                    // Continue the range
                    rangeEnd = currentDate;
                    rangeCount += datesByDay.get(currentDate) || 0;
                } else {
                    // End current range and start new one
                    dateRanges.push({
                        start: rangeStart,
                        end: rangeEnd,
                        count: rangeCount,
                    });
                    rangeStart = currentDate;
                    rangeEnd = currentDate;
                    rangeCount = datesByDay.get(currentDate) || 0;
                }
            }
            
            // Add the last range
            dateRanges.push({
                start: rangeStart,
                end: rangeEnd,
                count: rangeCount,
            });
        }

        // Find gaps (ranges between processed date ranges)
        const gaps: Array<{ start: string; end: string }> = [];
        for (let i = 0; i < dateRanges.length - 1; i++) {
            const currentEnd = new Date(dateRanges[i].end);
            const nextStart = new Date(dateRanges[i + 1].start);
            
            // Add one day to current end and subtract one day from next start
            currentEnd.setDate(currentEnd.getDate() + 1);
            nextStart.setDate(nextStart.getDate() - 1);
            
            // Only add gap if there's at least one day difference
            if (currentEnd <= nextStart) {
                gaps.push({
                    start: currentEnd.toISOString().split('T')[0],
                    end: nextStart.toISOString().split('T')[0],
                });
            }
        }

        // Get last processed date
        const lastProcessedDate = processedEmails[processedEmails.length - 1]?.processedAt.toISOString() || null;

        return {
            dateRanges,
            lastProcessedDate,
            gaps,
            totalProcessed,
        };
    } catch (error) {
        console.error("Error getting processing history:", error);
        return {
            dateRanges: [],
            lastProcessedDate: null,
            gaps: [],
            totalProcessed: 0,
        };
    }
}


/**
 * Process emails with date range filtering
 * This is the main function used by the EmailRetriever component
 */
export async function processEmailsWithDateRange(
    startDate?: Date,
    endDate?: Date,
    type: 'transactions' | 'offers' | 'both' = 'both',
    maxEmails: number = 50,
    skipCount: number = 0,
    provider: 'gmail' | 'outlook' | 'all' = 'all'
) {
    try {
        const cards = await getCards();
        
        // Get processed emails AND existing drafts to avoid duplicates
        const [processedEmails, existingDrafts] = await Promise.all([
            prisma.processedEmail.findMany({
                select: { emailId: true },
            }),
            prisma.draftTransaction.findMany({
                select: { emailId: true },
            }),
        ]);
        
        const processedEmailIds = new Set(processedEmails.map(e => e.emailId));

        // Build very broad query - fetch wide range of emails and let LLM do intelligent contextual classification
        // The LLM will understand email content and purpose, not just keywords
        let query = '';
        if (type === 'transactions') {
            // Very broad query - LLM will intelligently identify transaction emails based on content
            query = 'from:@bank OR from:@card OR from:@payment OR from:@alert OR "amount" OR "balance" OR "account" OR "INR" OR "Rs" OR "₹"';
        } else if (type === 'offers') {
            // Very broad query - LLM will intelligently identify offer emails based on content
            query = 'from:@offers OR from:@rewards OR from:@promotions OR "offer" OR "discount" OR "reward" OR "promotion" OR "cashback" OR "special" OR "deal" OR "sale" OR "%"';
        } else {
            // Extremely broad query for both - LLM will classify intelligently based on actual content
            query = 'from:@bank OR from:@card OR from:@payment OR from:@offers OR from:@rewards OR from:@alert OR "amount" OR "balance" OR "account" OR "INR" OR "Rs" OR "₹" OR "offer" OR "discount"';
        }

        const allEmails = await fetchEmails(maxEmails + skipCount, query, startDate, endDate, provider);
        const emails = allEmails.slice(skipCount, skipCount + maxEmails);
        
        console.log(`[Email Processor] Processing ${emails.length} emails (skipped ${skipCount}, total available: ${allEmails.length})`);
        console.log(`[Email Processor] Date range: ${startDate?.toISOString()} to ${endDate?.toISOString()}`);
        console.log(`[Email Processor] Email subjects (first 5):`, emails.slice(0, 5).map(e => e.subject));

        let transactionCount = 0;
        let offerCount = 0;
        const errors: string[] = [];
        let processedCount = 0;

        for (const email of emails) {
            // Check if any draft exists for this email by checking if any draft emailId starts with email.id
            // Draft emailId formats: 
            // - Regular: `${email.id}-${date}-${merchant}-${amount}`
            // - Statement: `${email.id}-stmt-${timestamp}`
            const hasExistingDrafts = existingDrafts.some(d => 
                d.emailId.startsWith(email.id + '-') || d.emailId === email.id
            );
            
            // Skip only if email was processed AND has existing drafts
            // This allows reprocessing if drafts were deleted or if processing failed before
            if (processedEmailIds.has(email.id) && hasExistingDrafts) {
                console.log(`[Email Processor] Skipping email ${email.id} - already processed with existing drafts`);
                continue;
            }
            
            // If processed but no drafts, log and reprocess
            if (processedEmailIds.has(email.id) && !hasExistingDrafts) {
                console.log(`[Email Processor] Reprocessing email ${email.id} - was processed but no drafts found`);
            }

            try {
                let emailBody = email.body;
                if (!emailBody || emailBody.trim().length === 0) {
                    emailBody = await getEmailContent(email.id, email.provider);
                }

                // Detect statements first
                const { detectStatement } = await import('@/lib/statement-utils');
                const { extractStatementData, reconcileStatement } = await import('@/lib/statement-service');
                const isStatement = detectStatement(email.subject, emailBody, email.attachments);
                
                if (isStatement) {
                    try {
                        console.log(`[Email Processor] Detected statement in email ${email.id}`);
                        let statementPassword: string | undefined;
                        const card = cards.find(c => 
                            email.subject.toLowerCase().includes(c.last4) ||
                            emailBody.includes(c.last4)
                        );
                        if (card) {
                            const cardWithPassword = await prisma.card.findUnique({
                                where: { id: card.id },
                                select: { statementPassword: true }
                            });
                            statementPassword = cardWithPassword?.statementPassword || undefined;
                        }
                        
                        let statementData = null;
                        try {
                            statementData = await extractStatementData(
                                email.subject,
                                emailBody,
                                email.attachments,
                                statementPassword,
                                email.id,
                                email.provider
                            );
                        } catch (statementError: any) {
                            // Log error but continue processing - don't crash entire email processing
                            console.error(`[Email Processor] Failed to extract statement from email ${email.id}:`, statementError.message);
                            // Continue to regular email analysis even if statement extraction fails
                        }
                        
                        if (statementData && statementData.transactions.length > 0) {
                            const existingTransactions = await prisma.transaction.findMany({
                                where: {
                                    cardId: statementData.cardId || undefined,
                                    date: {
                                        gte: statementData.statementPeriod.start,
                                        lte: statementData.statementPeriod.end,
                                    }
                                },
                                select: {
                                    id: true,
                                    date: true,
                                    amount: true,
                                    merchant: true,
                                    description: true,
                                }
                            });
                            
                            const reconciliation = await reconcileStatement(statementData, existingTransactions);
                            
                            for (const stmtTx of reconciliation.unmatched) {
                                await createDraftTransaction({
                                    emailId: `${email.id}-stmt-${stmtTx.date.getTime()}`,
                                    cardId: statementData.cardId || undefined,
                                    merchant: stmtTx.description.substring(0, 100),
                                    amount: stmtTx.amount,
                                    category: undefined,
                                    subCategory: undefined,
                                    description: stmtTx.description,
                                    date: stmtTx.date,
                                    transactionType: stmtTx.type === "debit" ? "expense" : "income",
                                    emailSubject: `Statement: ${email.subject}`,
                                    emailBody: `Extracted from bank statement`,
                                    originalData: JSON.stringify({ 
                                        source: 'statement', 
                                        reconciliation: 'unmatched',
                                        cardLast4: statementData.cardLast4,
                                        accountNumber: statementData.accountNumber,
                                        customerId: statementData.customerId,
                                        bankName: statementData.bankName,
                                    }),
                                    needsCardCreation: !statementData.cardId && (!!statementData.cardLast4 || !!statementData.accountNumber || !!statementData.customerId),
                                });
                                transactionCount++;
                            }
                            
                            if (statementData.offers && statementData.offers.length > 0) {
                                for (const offer of statementData.offers) {
                                    await createOffer({
                                        emailId: `${email.id}-stmt-offer-${Date.now()}`,
                                        title: offer.title,
                                        description: offer.description,
                                        cardId: statementData.cardId || undefined,
                                        startDate: new Date(),
                                        endDate: offer.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                                        senderEmail: email.from,
                                        emailSubject: `Statement Offer: ${email.subject}`,
                                        emailBody: offer.description,
                                    });
                                    offerCount++;
                                }
                            }
                            
                            // Only mark as processed if we actually created drafts
                            if (reconciliation.unmatched.length > 0 || (statementData.offers && statementData.offers.length > 0)) {
                                await prisma.processedEmail.upsert({
                                    where: { emailId: email.id },
                                    update: {
                                        emailSubject: email.subject,
                                        originalDate: email.date,
                                        emailBody: emailBody.substring(0, 10000), // Limit to 10k chars
                                        transactionCount: reconciliation.unmatched.length,
                                        offerCount: statementData.offers?.length || 0,
                                        status: "processed",
                                    },
                                    create: {
                                        emailId: email.id,
                                        emailSubject: email.subject,
                                        originalDate: email.date,
                                        emailBody: emailBody.substring(0, 10000), // Limit to 10k chars
                                        transactionCount: reconciliation.unmatched.length,
                                        offerCount: statementData.offers?.length || 0,
                                        status: "processed",
                                    },
                                });
                                processedCount++;
                            }
                            continue;
                        } else if (statementData && statementData.transactions.length === 0) {
                            // Statement detected but no transactions extracted - still mark as processed to avoid retrying
                            console.log(`[Email Processor] Statement email ${email.id} has no transactions to extract`);
                            await prisma.processedEmail.upsert({
                                where: { emailId: email.id },
                                update: {
                                    emailSubject: email.subject,
                                    originalDate: email.date,
                                    emailBody: emailBody.substring(0, 10000), // Limit to 10k chars
                                    transactionCount: 0,
                                    offerCount: 0,
                                    status: "processed",
                                },
                                create: {
                                    emailId: email.id,
                                    emailSubject: email.subject,
                                    originalDate: email.date,
                                    emailBody: emailBody.substring(0, 10000), // Limit to 10k chars
                                    transactionCount: 0,
                                    offerCount: 0,
                                    status: "processed",
                                },
                            });
                            processedCount++;
                            continue;
                        }
                    } catch (error: any) {
                        if (error.message?.includes('password')) {
                            errors.push(`Statement in email ${email.id} requires password.`);
                            await prisma.processedEmail.upsert({
                                where: { emailId: email.id },
                                update: {
                                    emailSubject: email.subject,
                                    originalDate: email.date,
                                    emailBody: emailBody.substring(0, 10000), // Limit to 10k chars
                                    status: "failed",
                                    errorMessage: "Password required for encrypted statement",
                                },
                                create: {
                                    emailId: email.id,
                                    emailSubject: email.subject,
                                    originalDate: email.date,
                                    emailBody: emailBody.substring(0, 10000), // Limit to 10k chars
                                    status: "failed",
                                    errorMessage: "Password required for encrypted statement",
                                },
                            });
                            continue;
                        }
                        console.error(`[Email Processor] Error processing statement:`, error);
                        errors.push(`Error processing statement in email ${email.id}: ${error.message}`);
                    }
                }

                // Analyze email with LLM (for non-statement emails)
                console.log(`[Email Processor] Analyzing email: "${email.subject.substring(0, 50)}..."`);
                const analysis = await analyzeEmail(
                    email.subject,
                    emailBody,
                    Array.from(processedEmailIds),
                    cards.map(c => ({ id: c.id, name: c.name, last4: c.last4, bank: c.bank }))
                );

                console.log(`[Email Processor] Analysis result: isTransaction=${analysis.isTransactionEmail}, isOffer=${analysis.isOfferEmail}, transactions=${analysis.transactions.length}, offers=${analysis.offers.length}`);

                if (type === 'transactions' || type === 'both') {
                    if (analysis.transactions.length === 0 && analysis.isTransactionEmail) {
                        console.warn(`[Email Processor] Email "${email.subject}" marked as transaction but no transactions extracted`);
                    }
                    // ALWAYS create drafts for all extracted transactions, regardless of card/account existence
                    for (const transaction of analysis.transactions) {
                        // Try to match to existing card/account, but don't require it
                        const cardId = await matchTransactionToCard(transaction, cards);
                        
                        // Set needsCardCreation if we detected card/account info but it's not in database
                        const needsCardCreation = !cardId && (!!transaction.cardLast4 || !!transaction.accountNumber || !!transaction.customerId);
                        
                        try {
                            await createDraftTransaction({
                                emailId: `${email.id}-${transaction.date}-${transaction.merchant}-${transaction.amount}`,
                                cardId: cardId || undefined, // Only set if matched, otherwise null
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
                                needsCardCreation: needsCardCreation, // Flag to suggest card/account creation
                            });
                            transactionCount++;
                            if (needsCardCreation) {
                                console.log(`[Email Processor] Created draft (needs card/account creation): ${transaction.merchant} - ${transaction.amount}`);
                            } else {
                                console.log(`[Email Processor] Created draft: ${transaction.merchant} - ${transaction.amount}`);
                            }
                        } catch (draftError: any) {
                            console.error(`[Email Processor] Failed to create draft:`, draftError);
                            errors.push(`Failed to create draft for ${transaction.merchant}: ${draftError.message}`);
                        }
                    }
                }

                if (type === 'offers' || type === 'both') {
                    for (const offer of analysis.offers) {
                        const cardId = cards.find(c => c.last4 === offer.cardLast4)?.id;
                        let startDate: Date;
                        let endDate: Date;
                        
                        try {
                            startDate = offer.startDate ? new Date(offer.startDate) : new Date();
                            if (isNaN(startDate.getTime())) startDate = new Date();
                        } catch {
                            startDate = new Date();
                        }

                        try {
                            endDate = offer.endDate ? new Date(offer.endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                            if (isNaN(endDate.getTime())) endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                        } catch {
                            endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                        }

                        let senderEmail: string | undefined;
                        if (email.from) {
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

                        if (result.success && !result.skipped) {
                            offerCount++;
                        }
                    }
                }

                // Only mark as processed if we actually created drafts/offers
                if (transactionCount > 0 || offerCount > 0 || analysis.transactions.length > 0 || analysis.offers.length > 0) {
                    await prisma.processedEmail.upsert({
                        where: { emailId: email.id },
                        update: {
                            emailSubject: email.subject,
                            originalDate: email.date,
                            emailBody: emailBody.substring(0, 10000), // Limit to 10k chars
                            transactionCount: analysis.transactions.length,
                            offerCount: analysis.offers.length,
                            status: "processed",
                        },
                        create: {
                            emailId: email.id,
                            emailSubject: email.subject,
                            originalDate: email.date,
                            emailBody: emailBody.substring(0, 10000), // Limit to 10k chars
                            transactionCount: analysis.transactions.length,
                            offerCount: analysis.offers.length,
                            status: "processed",
                        },
                    });
                    processedCount++;
                    console.log(`[Email Processor] Marked "${email.subject}" as processed (tx: ${analysis.transactions.length}, offers: ${analysis.offers.length})`);
                } else {
                    console.log(`[Email Processor] Email "${email.subject}" processed but no transactions/offers extracted - not marking as processed to allow retry`);
                }
            } catch (error: any) {
                console.error(`[Email Processor] Error processing email ${email.id}:`, error);
                errors.push(`Error processing email ${email.id}: ${error.message}`);
                // Use upsert to handle case where email already exists
                await prisma.processedEmail.upsert({
                    where: { emailId: email.id },
                    update: {
                        emailSubject: email.subject,
                        originalDate: email.date,
                        emailBody: emailBody?.substring(0, 10000) || null, // Limit to 10k chars
                        status: "failed",
                        errorMessage: error.message,
                    },
                    create: {
                        emailId: email.id,
                        emailSubject: email.subject,
                        originalDate: email.date,
                        emailBody: emailBody?.substring(0, 10000) || null, // Limit to 10k chars
                        status: "failed",
                        errorMessage: error.message,
                    },
                });
            }
        }

        revalidatePath("/drafts");
        revalidatePath("/offers");

        const hasMore = allEmails.length > skipCount + maxEmails;
        const nextSkip = hasMore ? skipCount + maxEmails : undefined;

        return {
            success: true,
            processed: processedCount,
            processedCount: processedCount,
            totalEmails: allEmails.length,
            totalAvailable: allEmails.length,
            transactions: transactionCount,
            offers: offerCount,
            errors: errors.length > 0 ? errors : undefined,
            hasMore,
            nextSkip,
        };
    } catch (error: any) {
        console.error("Error processing emails with date range:", error);
        return {
            success: false,
            error: error.message || "Failed to process emails",
        };
    }
}
