import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
    const acct = await prisma.bankAccount.findUnique({
        where: { id: params.id },
        include: {
            transactions: {
                orderBy: { date: "desc" },
                take: 50,
            },
        },
    });
    if (!acct) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const balance = acct.transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    return NextResponse.json({ account: { ...acct, balance } });
}
