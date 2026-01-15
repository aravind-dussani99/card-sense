"use server";

import { prisma } from "@/lib/prisma";
import { extractStatementData, reconcileStatement } from "@/lib/statement-service";
import { createDraftTransaction } from "./draft-transaction-actions";
import { createOffer } from "./offer-actions";
import { getEmailContent, getAttachment } from "@/lib/email-service";
import { revalidatePath } from "next/cache";

export interface ProcessStatementResult {
    success: boolean;
    statementData?: any;
    reconciliation?: {
        matched: Array<{ statement: any; existing: string }>;
        unmatched: any[];
        missing: Array<{ id: string; date: Date; amount: number; merchant: string }>;
    };
    error?: string;
}

/**
 * Process a statement email with password
 */
export async function processStatementWithPassword(
    emailId: string,
    emailSubject: string,
    emailBody: string,
    attachments: Array<{ filename: string; mimeType: string; attachmentId?: string; content?: Buffer }>,
    password: string,
    provider: "gmail" | "outlook"
): Promise<ProcessStatementResult> {
    try {
        const cards = await prisma.card.findMany({
            select: { id: true, name: true, last4: true, bank: true }
        });

        // Extract statement data with password
        const statementData = await extractStatementData(
            emailSubject,
            emailBody,
            attachments,
            password,
            emailId,
            provider,
            { forceProcessAttachments: true }
        );

        if (!statementData || statementData.transactions.length === 0) {
            return {
                success: false,
                error: "No transactions found in statement",
            };
        }

        // Get existing transactions for reconciliation
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

        // Reconcile
        const reconciliation = await reconcileStatement(
            statementData,
            existingTransactions
        );

        // Create draft transactions for unmatched
        for (const stmtTx of reconciliation.unmatched) {
            await createDraftTransaction({
                emailId: `${emailId}-stmt-${stmtTx.date.getTime()}`,
                cardId: statementData.cardId || undefined,
                merchant: stmtTx.description.substring(0, 100),
                amount: stmtTx.amount,
                category: undefined,
                subCategory: undefined,
                description: stmtTx.description,
                date: stmtTx.date,
                transactionType: stmtTx.type === "debit" ? "expense" : "income",
                emailSubject: `Statement: ${emailSubject}`,
                emailBody: `Extracted from bank statement`,
                originalData: JSON.stringify({ source: 'statement', reconciliation: 'unmatched' }),
            });
        }

        // Process offers
        if (statementData.offers && statementData.offers.length > 0) {
            for (const offer of statementData.offers) {
                await createOffer({
                    emailId: `${emailId}-stmt-offer-${Date.now()}`,
                    title: offer.title,
                    description: offer.description,
                    cardId: statementData.cardId || undefined,
                    startDate: new Date(),
                    endDate: offer.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    emailSubject: `Statement Offer: ${emailSubject}`,
                    emailBody: offer.description,
                });
            }
        }

        revalidatePath("/drafts");
        revalidatePath("/offers");

        return {
            success: true,
            statementData,
            reconciliation,
        };
    } catch (error: any) {
        console.error("Error processing statement with password:", error);
        return {
            success: false,
            error: error.message || "Failed to process statement",
        };
    }
}

/**
 * Process manual statement input
 */
export async function processManualStatement(data: {
    cardId?: string;
    statementText: string;
    statementPeriodStart?: Date;
    statementPeriodEnd?: Date;
}): Promise<ProcessStatementResult> {
    try {
        const cards = await prisma.card.findMany({
            select: { id: true, name: true, last4: true, bank: true }
        });

        const card = data.cardId ? cards.find(c => c.id === data.cardId) : undefined;

        // Extract statement data from text
        const { extractStatementWithLLM } = await import('@/lib/statement-service');
        const statementData = await extractStatementWithLLM(
            data.statementText,
            "Manual Statement Upload",
            cards
        );

        if (!statementData) {
            return {
                success: false,
                error: "Failed to extract statement data",
            };
        }

        // Override card ID and statement period if provided
        if (data.cardId) {
            statementData.cardId = data.cardId;
        }
        if (data.statementPeriodStart) {
            statementData.statementPeriod.start = data.statementPeriodStart;
        }
        if (data.statementPeriodEnd) {
            statementData.statementPeriod.end = data.statementPeriodEnd;
        }

        // Get existing transactions for reconciliation
        const existingTransactions = statementData.cardId ? await prisma.transaction.findMany({
            where: {
                cardId: statementData.cardId,
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
        }) : [];

        // Reconcile
        const { reconcileStatement } = await import('@/lib/statement-service');
        const reconciliation = await reconcileStatement(
            statementData,
            existingTransactions
        );

        // Create draft transactions for unmatched
        for (const stmtTx of reconciliation.unmatched) {
            await createDraftTransaction({
                emailId: `manual-stmt-${Date.now()}-${stmtTx.date.getTime()}`,
                cardId: data.cardId,
                merchant: stmtTx.description.substring(0, 100),
                amount: stmtTx.amount,
                category: undefined,
                subCategory: undefined,
                description: stmtTx.description,
                date: stmtTx.date,
                transactionType: stmtTx.type === "debit" ? "expense" : "income",
                emailSubject: "Manual Statement Upload",
                emailBody: `Extracted from manually uploaded statement`,
                originalData: JSON.stringify({ source: 'manual_statement', reconciliation: 'unmatched' }),
            });
        }

        // Process offers
        if (statementData.offers && statementData.offers.length > 0) {
            for (const offer of statementData.offers) {
                await createOffer({
                    emailId: `manual-stmt-offer-${Date.now()}`,
                    title: offer.title,
                    description: offer.description,
                    cardId: data.cardId,
                    startDate: new Date(),
                    endDate: offer.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    emailSubject: "Manual Statement Offer",
                    emailBody: offer.description,
                });
            }
        }

        revalidatePath("/drafts");
        revalidatePath("/offers");
        revalidatePath("/statements");

        return {
            success: true,
            statementData,
            reconciliation,
        };
    } catch (error: any) {
        console.error("Error processing manual statement:", error);
        return {
            success: false,
            error: error.message || "Failed to process statement",
        };
    }
}

/**
 * Get processed statements
 */
export async function getProcessedStatements() {
    try {
        // SQLite doesn't support case-insensitive mode, so we'll filter in memory
        const allProcessedEmails = await prisma.processedEmail.findMany({
            orderBy: { processedAt: "desc" },
            take: 100, // Get more to filter
        });

        // Filter for statements (case-insensitive)
        const processedEmails = allProcessedEmails.filter(email => 
            email.emailSubject?.toLowerCase().includes("statement")
        ).slice(0, 50);

        return processedEmails;
    } catch (error) {
        console.error("Error fetching processed statements:", error);
        return [];
    }
}
