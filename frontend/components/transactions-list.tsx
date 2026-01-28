"use client";

import { TransactionsWorkbench } from "@/components/transactions/workbench"
import { BankAccount, Card, Category, SubCategory } from "@/lib/types";

interface TransactionsListProps {
    cards: Card[];
    categories: Category[];
    accounts: BankAccount[];
}

export function TransactionsList({ cards, categories, accounts }: TransactionsListProps) {
    return (
        <div className="space-y-4">
            <TransactionsWorkbench
                accounts={accounts.map((account: BankAccount) => ({
                    id: account.id,
                    label: account.name || account.type || "Account",
                    helper: account.mask ? `••${account.mask}` : account.type || undefined,
                    type: "account" as const,
                }))}
                cards={cards.map((card: Card) => ({
                    id: card.id,
                    label: card.name,
                    helper: card.last4 ? `••${card.last4}` : undefined,
                    type: "card" as const,
                }))}
                initialDrafts={[]}
                initialMeta={{ total: 0, page: 1, pageSize: 15 }}
                categories={categories.map((category: Category) => ({
                    id: category.id,
                    name: category.name,
                    subCategories: (category.subCategories || []).map((sub: SubCategory) => ({
                        id: sub.id,
                        name: sub.name,
                        categoryId: sub.categoryId || category.id,
                    })),
                }))}
            />
        </div>
    );
}
