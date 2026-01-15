import { prisma } from "@/lib/prisma";

export async function answerQuestion(question: string) {
    const q = question.toLowerCase();
    const parts: string[] = [];

    if (q.includes("how many cards")) {
        const count = await prisma.card.count();
        parts.push(`You have ${count} card${count === 1 ? "" : "s"}.`);
    }

    if (q.includes("total balance") || q.includes("total balances") || q.includes("total payable") || q.includes("total payables")) {
        const cards = await prisma.card.aggregate({ _sum: { balance: true } });
        const cardBal = cards._sum.balance || 0;
        const bank = await prisma.bankTransaction.groupBy({
            by: ["accountId"],
            _sum: { amount: true },
        });
        const bankBal = bank.reduce((acc, b) => acc + (b._sum.amount || 0), 0);
        parts.push(`Card balances sum to ${cardBal.toFixed(2)}. Bank accounts sum to ${bankBal.toFixed(2)}.`);
    }

    if (q.includes("receivable") || q.includes("receive")) {
        const receivableDrafts = await prisma.draftTransaction.aggregate({
            _sum: { amount: true },
            where: {
                OR: [
                    { category: { contains: "Hand Loan", mode: "insensitive" } },
                    { subCategory: { contains: "receive", mode: "insensitive" } },
                    { description: { contains: "loan", mode: "insensitive" } },
                ],
            },
        });
        const receivableTx = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: {
                OR: [
                    { category: { contains: "Hand Loan", mode: "insensitive" } },
                    { subCategory: { contains: "receive", mode: "insensitive" } },
                    { description: { contains: "loan", mode: "insensitive" } },
                ],
            },
        });
        const amt = (receivableDrafts._sum.amount || 0) + (receivableTx._sum.amount || 0);
        parts.push(`Potential receivables flagged: ${amt.toFixed(2)}.`);
    }

    if (q.includes("owe") || q.includes("payable") || q.includes("payables")) {
        const payables = await prisma.transaction.aggregate({
            _sum: { amount: true },
            where: { amount: { lt: 0 } },
        });
        parts.push(`Payables (negative transactions) total ${(payables._sum.amount || 0).toFixed(2)}.`);
    }

    // Person-specific query
    const personMatch = q.match(/owe to ([a-z0-9\s]+)|owed by ([a-z0-9\s]+)/);
    if (personMatch) {
        const name = (personMatch[1] || personMatch[2] || "").trim();
        if (name) {
            const tx = await prisma.transaction.aggregate({
                _sum: { amount: true },
                where: {
                    OR: [
                        { merchant: { contains: name, mode: "insensitive" } },
                        { description: { contains: name, mode: "insensitive" } },
                    ],
                },
            });
            parts.push(`Transactions involving ${name}: total ${(tx._sum.amount || 0).toFixed(2)}.`);
        }
    }

    if (parts.length === 0) {
        parts.push("I couldn’t map that to a known query. Try asking about card counts, total balances, receivables, or payables.");
    }
    return parts.join(" ");
}
