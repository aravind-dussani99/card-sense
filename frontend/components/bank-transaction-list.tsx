"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type BankTransactionLite = {
    id: string;
    merchant?: string | null;
    descriptionVia?: string | null;
    category?: string | null;
    amount: number;
    currency?: string | null;
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
        <div className="space-y-4">
            {transactions.slice(0, 10).map((transaction) => {
                const title = transaction.merchant || transaction.descriptionVia || "Unknown";
                return (
                    <div key={transaction.id} className="flex items-center gap-4">
                        <Avatar className="h-9 w-9">
                            <AvatarFallback>{title[0]}</AvatarFallback>
                        </Avatar>
                        <div className="ml-4 flex-1 space-y-1">
                            <p className="text-sm font-medium leading-none">{title}</p>
                            <p className="text-sm text-muted-foreground">
                                {transaction.category || "Uncategorized"} {transaction.account ? `• ${transaction.account.name || transaction.account.type || "Account"}` : ""}
                            </p>
                        </div>
                        <div className="ml-auto font-medium">
                            {formatAmount(transaction.amount, transaction.currency)}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
