import { Metadata } from "next"
import { MainNav } from "@/components/main-nav"
import { BalanceDashboard } from "@/components/balance-dashboard"
import { getCards } from "@/app/actions/card-actions"
import { getCategories } from "@/app/actions/category-actions"
import { getBankTransactions } from "@/app/actions/transaction-actions"
import { getBankAccounts } from "@/app/actions/bank-actions"
import { BankAccount, BankTransaction, Card, Category } from "@/lib/types"

export const metadata: Metadata = {
    title: "Balance Tracking - CardSense",
    description: "Track all balances, receivables, and payables.",
}

export default async function BalancesPage() {
    const cards: Card[] = await getCards();
    const categories: Category[] = await getCategories();
    const [transactions, bankAccounts] = await Promise.all([
        getBankTransactions(1000),
        getBankAccounts(),
    ]);
    const mapped = (transactions as BankTransaction[]).map((tx) => ({
        id: tx.id,
        cardId: null,
        bankAccountId: tx.accountId || null,
        category: tx.category || "Uncategorized",
        subCategory: tx.meta?.subCategory || null,
        merchant: tx.merchant || tx.descriptionVia || "Unknown",
        merchantTo: tx.merchant || tx.descriptionVia || "Unknown",
        description: tx.descriptionVia || "",
        descriptionVia: tx.descriptionVia || "",
        amount: tx.amount,
        transactionType: tx.amount < 0 ? "expense" : "income",
        direction: tx.amount < 0 ? "debit" : "credit",
        loanTo: null,
        loanFrom: null,
        date: tx.date ? new Date(tx.date).toISOString() : new Date().toISOString(),
        notes: null,
        remarks: tx.meta?.remarks || null,
    }));

    return (
        <div className="flex flex-col min-h-screen">
            <div className="border-b bg-white/80 backdrop-blur-md shadow-sm">
                <div className="flex h-16 items-center px-4">
                    <h1 className="text-xl font-bold mr-8 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">CardSense</h1>
                    <MainNav className="mx-6" />
                </div>
            </div>
            <div className="flex-1">
                    <BalanceDashboard 
                        cards={cards.map((card) => ({
                            id: card.id,
                            name: card.name ?? null,
                            last4: card.last4 ?? null,
                            balance: card.balance ?? undefined,
                            limit: card.limit ?? undefined,
                        }))}
                        accounts={bankAccounts as BankAccount[]}
                        categories={categories} 
                        initialTransactions={mapped}
                    />
            </div>
        </div>
    )
}
