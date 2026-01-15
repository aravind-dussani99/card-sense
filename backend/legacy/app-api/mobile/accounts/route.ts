import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const accounts = await prisma.bankAccount.findMany({
        where: { status: { not: "deleted" } },
        include: {
            transactions: {
                select: { amount: true },
            },
        },
    });
    const result = accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        currency: a.currency,
        mask: a.mask,
        status: a.status,
        balance: a.transactions.reduce((sum, t) => sum + (t.amount || 0), 0),
    }));
    return NextResponse.json({ accounts: result });
}
