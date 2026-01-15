import { NextRequest, NextResponse } from "next/server";
import { processStatementWithPassword } from "@/app/actions/statement-actions";
import { extractStatementData } from "@/lib/statement-service";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const cardId = (formData.get('cardId') as string) || undefined;
        const password = formData.get('password') as string | null;
        const statementPeriodStart = formData.get('statementPeriodStart') as string | null;
        const statementPeriodEnd = formData.get('statementPeriodEnd') as string | null;

        if (!file) {
            return NextResponse.json(
                { success: false, error: "File is required" },
                { status: 400 }
            );
        }

        // Read file content
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Create attachment-like object
        const attachments = [{
            filename: file.name,
            mimeType: file.type,
            content: buffer,
        }];

        // Extract statement data
        const statementData = await extractStatementData(
            `Manual Upload: ${file.name}`,
            "",
            attachments,
            password || undefined,
            `manual-${Date.now()}`,
            "gmail", // Provider doesn't matter for manual uploads
            { forceProcessAttachments: true }
        );

        if (!statementData || statementData.transactions.length === 0) {
            return NextResponse.json(
                { success: false, error: "No transactions found in statement" },
                { status: 400 }
            );
        }

        // Prefer explicit card override, else use detected cardId/cardLast4 match
        if (cardId) {
            statementData.cardId = cardId;
        }
        if (statementPeriodStart) {
            statementData.statementPeriod.start = new Date(statementPeriodStart);
        }
        if (statementPeriodEnd) {
            statementData.statementPeriod.end = new Date(statementPeriodEnd);
        }

        // Get existing transactions for reconciliation
        const { prisma } = await import('@/lib/prisma');
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
        const { createDraftTransaction } = await import('@/app/actions/draft-transaction-actions');
        for (const stmtTx of reconciliation.unmatched) {
            await createDraftTransaction({
                emailId: `manual-stmt-${Date.now()}-${stmtTx.date.getTime()}`,
                cardId: statementData.cardId,
                merchant: stmtTx.description.substring(0, 100),
                amount: stmtTx.amount,
                category: undefined,
                subCategory: undefined,
                description: stmtTx.description,
                date: stmtTx.date,
                transactionType: stmtTx.type === "debit" ? "expense" : "income",
                emailSubject: `Manual Upload: ${file.name}`,
                emailBody: `Extracted from manually uploaded statement file`,
                originalData: JSON.stringify({ source: 'manual_statement', reconciliation: 'unmatched' }),
            });
        }

        // Process offers
        if (statementData.offers && statementData.offers.length > 0) {
            const { createOffer } = await import('@/app/actions/offer-actions');
            for (const offer of statementData.offers) {
                await createOffer({
                    emailId: `manual-stmt-offer-${Date.now()}`,
                    title: offer.title,
                    description: offer.description,
                    cardId: cardId,
                    startDate: new Date(),
                    endDate: offer.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    emailSubject: `Manual Statement Offer: ${file.name}`,
                    emailBody: offer.description,
                });
            }
        }

        return NextResponse.json({
            success: true,
            statementData,
            reconciliation,
        });
    } catch (error: any) {
        console.error("Error processing statement upload:", error);
        const message = error.message || "Failed to process statement";
        const status = message.toLowerCase().includes('password') ? 400 : 500;
        return NextResponse.json(
            { success: false, error: message },
            { status }
        );
    }
}
