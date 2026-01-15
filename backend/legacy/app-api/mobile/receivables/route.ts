import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    // Receivables: loan_received (money owed to user)
    const loans = await prisma.transaction.findMany({
        where: { transactionType: "loan_received" },
        select: { loanFrom: true, amount: true },
    });
    const map = new Map<string, number>();
    for (const l of loans) {
        const key = l.loanFrom || "Unknown";
        map.set(key, (map.get(key) || 0) + (l.amount || 0));
    }
    const receivables = Array.from(map.entries()).map(([person, total]) => ({ person, total }));
    return NextResponse.json({ receivables });
}
