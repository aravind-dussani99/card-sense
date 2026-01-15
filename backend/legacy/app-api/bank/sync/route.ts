import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchAccounts, fetchCards, fetchTransactions } from "@/lib/truelayer-client";
import { resolveCategory, resolveCategoryFromRecord } from "@/lib/category-resolver";

// Placeholder: manual sync endpoint to pull latest transactions for all connections (or by user)
export async function POST(req: NextRequest) {
    try {
        let userId: string | undefined;
        let accountId: string | undefined;
        let fromDate: string | undefined;
        let toDate: string | undefined;
        const contentType = req.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            const body = await req.json();
            userId = body.userId;
            accountId = body.accountId;
            fromDate = body.fromDate;
            toDate = body.toDate;
        } else {
            const form = await req.formData();
            userId = (form.get("userId") as string) || undefined;
            accountId = (form.get("accountId") as string) || undefined;
            fromDate = (form.get("fromDate") as string) || undefined;
            toDate = (form.get("toDate") as string) || undefined;
        }

        let connections;
        if (accountId) {
            const acct = await prisma.bankAccount.findUnique({
                where: { id: accountId },
                include: { connection: true },
            });
            if (!acct || !acct.connection) {
                return NextResponse.json({ success: false, error: "Account not found or missing connection" }, { status: 400 });
            }
            connections = [acct.connection];
        } else {
            connections = await prisma.bankConnection.findMany({
                where: userId ? { userId } : undefined,
            });
        }
        let synced = 0;
        for (const connection of connections) {
            try {
                const accounts = await fetchAccounts(connection.accessToken).catch(() => []);
                const cards = await fetchCards(connection.accessToken).catch(() => []);
                const allAccounts = [
                    ...accounts
                        .map((a: any) => ({
                            id: a.account_id,
                            type: a.account_type || a.type || "account",
                            name: a.display_name || a.account_id,
                            currency: a.currency,
                            mask: a.account_number?.iban || a.account_number?.number?.slice(-4),
                        }))
                        .filter((a: any) => a.id),
                    ...cards
                        .map((c: any) => ({
                            id: c.card_id || c.account_id || c.resource_id || c.display_name || c.name_on_card,
                            type: "card",
                            name: c.display_name || c.name_on_card || c.card_network,
                            currency: c.currency,
                            mask: c.partial_card_number || c.card_number?.slice(-4),
                        }))
                        .filter((c: any) => c.id),
                ];

                for (const acct of allAccounts) {
                    const account = await prisma.bankAccount.upsert({
                        where: { providerAccountId: acct.id },
                        update: {
                            connectionId: connection.id,
                            type: acct.type,
                            name: acct.name,
                            currency: acct.currency,
                            mask: acct.mask,
                            status: "active",
                        },
                        create: {
                            connectionId: connection.id,
                            providerAccountId: acct.id,
                            type: acct.type,
                            name: acct.name,
                            currency: acct.currency,
                            mask: acct.mask,
                            status: "active",
                        },
                    });

                    // If accountId filter is provided, skip other accounts
                    if (accountId && acct.id !== account.providerAccountId) continue;

                    const txns = await fetchTransactions(connection.accessToken, acct.id, fromDate, toDate).catch(() => []);
                    for (const tx of txns) {
                        const providerTransactionId = tx.transaction_id || tx.id || tx.normalised_provider_transaction_id;
                        if (!providerTransactionId) continue;
                        const rawString = JSON.stringify(tx);
                        const direction = tx.amount?.value && tx.amount.value < 0 ? "debit" : "credit";
                        const mappedCategory = await resolveCategory(tx);
                        await prisma.bankTransaction.upsert({
                            where: { providerTransactionId },
                            update: {
                                accountId: account.id,
                                amount: tx.amount?.value ?? tx.amount ?? 0,
                                currency: tx.amount?.currency ?? tx.currency ?? null,
                                descriptionVia: tx.description || tx.merchant_name || null,
                                merchant: tx.merchant_name || null,
                                category: mappedCategory,
                                direction,
                                date: tx.timestamp ? new Date(tx.timestamp) : new Date(),
                                pending: Boolean(tx.status && tx.status !== "posted"),
                                raw: rawString,
                            },
                            create: {
                                accountId: account.id,
                                providerTransactionId,
                                amount: tx.amount?.value ?? tx.amount ?? 0,
                                currency: tx.amount?.currency ?? tx.currency ?? null,
                                descriptionVia: tx.description || tx.merchant_name || null,
                                merchant: tx.merchant_name || null,
                                category: mappedCategory,
                                direction,
                                date: tx.timestamp ? new Date(tx.timestamp) : new Date(),
                                pending: Boolean(tx.status && tx.status !== "posted"),
                                raw: rawString,
                            },
                        });
                        const existingTx = await prisma.transaction.findUnique({
                            where: { providerTxId: providerTransactionId },
                            select: { id: true },
                        });
                        if (!existingTx) {
                            await prisma.draftTransaction.upsert({
                                where: { providerTxId: providerTransactionId },
                                update: {
                                    bankAccountId: account.id,
                                    providerTxId: providerTransactionId,
                                    source: "open_banking",
                                    merchant: tx.merchant_name || tx.description || "Unknown",
                                    amount: Math.abs(tx.amount?.value ?? tx.amount ?? 0),
                                    category: mappedCategory,
                                    description: tx.description || tx.merchant_name || null,
                                    date: tx.timestamp ? new Date(tx.timestamp) : new Date(),
                                    transactionType: tx.amount?.value && tx.amount.value < 0 ? "expense" : "income",
                                    originalData: rawString,
                                    needsCardCreation: true,
                                    status: "pending",
                                },
                                create: {
                                    bankAccountId: account.id,
                                    providerTxId: providerTransactionId,
                                    source: "open_banking",
                                    merchant: tx.merchant_name || tx.description || "Unknown",
                                    amount: Math.abs(tx.amount?.value ?? tx.amount ?? 0),
                                    category: mappedCategory,
                                    description: tx.description || tx.merchant_name || null,
                                    date: tx.timestamp ? new Date(tx.timestamp) : new Date(),
                                    transactionType: tx.amount?.value && tx.amount.value < 0 ? "expense" : "income",
                                    originalData: rawString,
                                    needsCardCreation: true,
                                    status: "pending",
                                },
                            });
                        }
                    }

                    const existingRows = await prisma.bankTransaction.findMany({
                        where: {
                            accountId: account.id,
                            ...(fromDate || toDate ? { date: { gte: fromDate, lte: toDate } } : {}),
                        },
                        select: { id: true, category: true, raw: true, merchant: true, descriptionVia: true },
                    });
                    for (const row of existingRows) {
                        const mapped = await resolveCategoryFromRecord(row);
                        if (mapped && mapped !== row.category) {
                            await prisma.bankTransaction.update({
                                where: { id: row.id },
                                data: { category: mapped },
                            });
                        }
                    }
                }
                synced += 1;
            } catch (err) {
                console.error("Sync error for connection", connection.id, err);
            }
        }
        return NextResponse.json({ success: true, synced });
    } catch (error: any) {
        console.error("Bank sync error:", error);
        return NextResponse.json({ success: false, error: error.message || "Failed to sync" }, { status: 500 });
    }
}
