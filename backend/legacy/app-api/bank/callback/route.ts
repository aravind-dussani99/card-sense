import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exchangeCodeForTokens, fetchAccounts, fetchCards, fetchInfo, fetchTransactions } from "@/lib/truelayer-client";
import { resolveCategory } from "@/lib/category-resolver";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const code = searchParams.get("code");
        const state = searchParams.get("state") || "";
        const userId = searchParams.get("userId") || state || "sandbox-user";
        const redirectUri = process.env.TRUELAYER_REDIRECT_URI || "http://localhost:3000/api/bank/callback";

        if (!code) {
            return NextResponse.json({ success: false, error: "Missing code" }, { status: 400 });
        }

        const tokenData = await exchangeCodeForTokens(code, redirectUri);
        const info = await fetchInfo(tokenData.access_token).catch(() => null);
        const providerAccountId = info?.user_id || crypto.randomUUID();

        const connection = await prisma.bankConnection.create({
            data: {
                userId,
                provider: "truelayer",
                providerAccountId,
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token || null,
                institutionId: info?.provider_id || null,
                status: "active",
            },
        });

        // Fetch accounts and cards, store them
        const accounts = await fetchAccounts(tokenData.access_token).catch(() => []);
        const cards = await fetchCards(tokenData.access_token).catch(() => []);

        for (const acct of accounts) {
            await prisma.bankAccount.upsert({
                where: { providerAccountId: acct.account_id },
                update: {
                    connectionId: connection.id,
                    type: acct.account_type || acct.type || null,
                    name: acct.display_name || acct.account_id || null,
                    currency: acct.currency || null,
                    mask: acct.account_number?.iban || acct.account_number?.number?.slice(-4) || null,
                    status: "active",
                },
                create: {
                    connectionId: connection.id,
                    providerAccountId: acct.account_id,
                    type: acct.account_type || acct.type || null,
                    name: acct.display_name || acct.account_id || null,
                    currency: acct.currency || null,
                    mask: acct.account_number?.iban || acct.account_number?.number?.slice(-4) || null,
                    status: "active",
                },
            });
        }

        for (const card of cards) {
            const providerAccountId = card.card_id || card.account_id || card.resource_id || card.display_name || card.name_on_card;
            if (!providerAccountId) continue; // skip if no unique id
            await prisma.bankAccount.upsert({
                where: { providerAccountId },
                update: {
                    connectionId: connection.id,
                    type: "card",
                    name: card.display_name || card.name_on_card || card.card_network || card.card_type || null,
                    currency: card.currency || null,
                    mask: card.partial_card_number || card.card_number?.slice(-4) || null,
                    status: "active",
                },
                create: {
                    connectionId: connection.id,
                    providerAccountId,
                    type: "card",
                    name: card.display_name || card.name_on_card || card.card_network || card.card_type || null,
                    currency: card.currency || null,
                    mask: card.partial_card_number || card.card_number?.slice(-4) || null,
                    status: "active",
                },
            });
        }

        // Optional: initial transaction fetch for accounts -> drafts + bankTransactions
        for (const acct of accounts) {
            const txns = await fetchTransactions(tokenData.access_token, acct.account_id).catch(() => []);
            const accountId = await ensureAccountId(connection.id, acct.account_id);
            for (const tx of txns) {
                const providerTransactionId = tx.transaction_id || tx.id || tx.normalised_provider_transaction_id;
                if (!providerTransactionId) continue;
                const rawString = JSON.stringify(tx);

                const direction = tx.amount?.value && tx.amount.value < 0 ? "debit" : "credit";
                const mappedCategory = await resolveCategory(tx);
                await prisma.bankTransaction.upsert({
                    where: { providerTransactionId },
                    update: {
                        accountId,
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
                        accountId,
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
                            bankAccountId: accountId,
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
                            bankAccountId: accountId,
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
        }

        // Redirect back to UI (adjust path as needed)
        const redirect = process.env.POST_CONNECT_REDIRECT || "/settings";
        return NextResponse.redirect(new URL(redirect, req.url));
    } catch (error: any) {
        console.error("Bank callback error:", error);
        return NextResponse.json({ success: false, error: error.message || "Callback failed" }, { status: 500 });
    }
}

async function ensureAccountId(connectionId: string, providerAccountId: string) {
    const existing = await prisma.bankAccount.findUnique({ where: { providerAccountId } });
    if (existing) return existing.id;
    const created = await prisma.bankAccount.create({
        data: {
            connectionId,
            providerAccountId,
            type: "account",
            status: "active",
        },
    });
    return created.id;
}
