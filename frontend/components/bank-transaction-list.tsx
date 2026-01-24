"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type BankTransactionLite = {
    id: string;
    merchant?: string | null;
    descriptionVia?: string | null;
    category?: string | null;
    amount: number;
    currency?: string | null;
    date?: string | null;
    account?: { name?: string | null; type?: string | null } | null;
};

export function BankTransactionList({ transactions }: { transactions: BankTransactionLite[] }) {
    if (!transactions.length) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                No transactions yet. Add a transaction to see activity.
            </div>
        );
    }

    const formatAmount = (amount: number, currency?: string | null) => {
        const sign = amount < 0 ? "-" : "";
        const abs = Math.abs(amount);
        return `${sign}${currency || "$"}${abs.toFixed(2)}`;
    };

    return (
        <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                        <th className="px-3 py-2 text-left font-medium">Date</th>
                        <th className="px-3 py-2 text-left font-medium">Merchant</th>
                        <th className="px-3 py-2 text-left font-medium">Category</th>
                        <th className="px-3 py-2 text-left font-medium">Account</th>
                        <th className="px-3 py-2 text-right font-medium">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {transactions.slice(0, 10).map((transaction) => {
                        const title = transaction.merchant || transaction.descriptionVia || "Unknown";
                        const dateLabel = transaction.date
                            ? new Date(transaction.date).toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                              })
                            : "—";
                        const accountLabel = transaction.account
                            ? transaction.account.name || transaction.account.type || "Account"
                            : "—";
                        return (
                            <tr key={transaction.id} className="border-t">
                                <td className="px-3 py-2">{dateLabel}</td>
                                <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-7 w-7">
                                            <AvatarFallback>{title[0]}</AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium">{title}</span>
                                    </div>
                                </td>
                                <td className="px-3 py-2">{transaction.category || "Uncategorized"}</td>
                                <td className="px-3 py-2">{accountLabel}</td>
                                <td className="px-3 py-2 text-right font-medium">
                                    {formatAmount(transaction.amount, transaction.currency)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
