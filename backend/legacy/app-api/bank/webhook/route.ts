import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Minimal webhook handler (signature verification TODO)
export async function POST(req: NextRequest) {
    try {
        const payload = await req.json();
        const eventType = payload?.event_type;
        const connectionId = payload?.connection_id;
        const transactions = payload?.transactions || [];

        if (eventType === "transaction.created" || eventType === "transaction.updated") {
            for (const tx of transactions) {
                const accountId = await findAccountId(connectionId, tx.account_id);
                if (!accountId) continue;
                await prisma.bankTransaction.upsert({
                    where: { providerTransactionId: tx.transaction_id },
                    update: {
                        accountId,
                        amount: tx.amount?.value ?? tx.amount ?? 0,
                        currency: tx.amount?.currency ?? tx.currency ?? null,
                        description: tx.description || tx.merchant_name || null,
                        merchant: tx.merchant_name || null,
                        category: (tx.transaction_category || tx.category || [])[0] || null,
                        date: tx.timestamp ? new Date(tx.timestamp) : new Date(),
                        pending: Boolean(tx.status && tx.status !== "posted"),
                        raw: tx,
                    },
                    create: {
                        accountId,
                        providerTransactionId: tx.transaction_id,
                        amount: tx.amount?.value ?? tx.amount ?? 0,
                        currency: tx.amount?.currency ?? tx.currency ?? null,
                        description: tx.description || tx.merchant_name || null,
                        merchant: tx.merchant_name || null,
                        category: (tx.transaction_category || tx.category || [])[0] || null,
                        date: tx.timestamp ? new Date(tx.timestamp) : new Date(),
                        pending: Boolean(tx.status && tx.status !== "posted"),
                        raw: tx,
                    },
                });
            }
        }

        if (eventType === "connection.deauthorized" && connectionId) {
            await prisma.bankConnection.updateMany({
                where: { providerAccountId: connectionId },
                data: { status: "revoked" },
            });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Bank webhook error:", error);
        return NextResponse.json({ success: false, error: error.message || "Failed to process webhook" }, { status: 500 });
    }
}

async function findAccountId(connectionId?: string, providerAccountId?: string) {
    if (!providerAccountId) return null;
    const account = await prisma.bankAccount.findUnique({ where: { providerAccountId } });
    if (account) return account.id;
    if (connectionId) {
        const created = await prisma.bankAccount.create({
            data: {
                connection: { connect: { providerAccountId: connectionId } },
                providerAccountId,
                type: "account",
                status: "active",
            },
        });
        return created.id;
    }
    return null;
}
