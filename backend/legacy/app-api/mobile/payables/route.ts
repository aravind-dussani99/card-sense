import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    // Payables: loan_given (money user expects back, negative cash)
    const loans = await prisma.transaction.findMany({
        where: { transactionType: "loan_given" },
        select: { loanTo: true, amount: true },
    });
    const map = new Map<string, number>();
    for (const l of loans) {
        const key = l.loanTo || "Unknown";
        map.set(key, (map.get(key) || 0) + (l.amount || 0));
    }
    const payables = Array.from(map.entries()).map(([person, total]) => ({ person, total }));
    return NextResponse.json({ payables });
}
