"use client";

import { TransactionsWorkbench } from "@/components/transactions/workbench"

interface TransactionsListProps {
    cards: any[];
    categories: any[];
    accounts: any[];
}

export function TransactionsList({ cards, categories, accounts }: TransactionsListProps) {
    return (
        <div className="space-y-4">
            <TransactionsWorkbench
                accounts={accounts.map((account: any) => ({
                    id: account.id,
                    label: account.name || account.type || "Account",
                    helper: account.mask ? `••${account.mask}` : account.type || undefined,
                    type: "account" as const,
                }))}
                cards={cards.map((card: any) => ({
                    id: card.id,
                    label: card.name,
                    helper: card.last4 ? `••${card.last4}` : undefined,
                    type: "card" as const,
                }))}
                initialDrafts={[]}
                initialMeta={{ total: 0, page: 1, pageSize: 15 }}
                categories={categories.map((category: any) => ({
                    id: category.id,
                    name: category.name,
                    subCategories: (category.subCategories || []).map((sub: any) => ({
                        id: sub.id,
                        name: sub.name,
                        categoryId: sub.categoryId,
                    })),
                }))}
            />
        </div>
    );
}
