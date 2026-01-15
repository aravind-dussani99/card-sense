import { Metadata } from "next"
import { MainNav } from "@/components/main-nav"
import { BalanceDashboard } from "@/components/balance-dashboard"
import { FloatingAddButton } from "@/components/floating-add-button"
import { getCards } from "@/app/actions/card-actions"
import { getCategories } from "@/app/actions/category-actions"
import { getTransactions } from "@/app/actions/transaction-actions"

export const metadata: Metadata = {
    title: "Balance Tracking - CardSense",
    description: "Track all balances, receivables, and payables.",
}

export default async function BalancesPage() {
    const cards = await getCards();
    const categories = await getCategories();
    const transactions = await getTransactions({ limit: 1000 });
    const mapped = transactions.map((tx: any) => ({
        id: tx.id,
        cardId: tx.cardId || undefined,
        bankAccountId: null,
        category: tx.category || "Uncategorized",
        subCategory: tx.subCategory || null,
        merchant: tx.merchant || "Unknown",
        merchantTo: tx.merchant || "Unknown",
        description: tx.description || "",
        descriptionVia: tx.description || "",
        amount: tx.amount,
        transactionType: tx.transactionType || "expense",
        direction: tx.amount < 0 ? "debit" : "credit",
        loanTo: tx.loanTo || null,
        loanFrom: tx.loanFrom || null,
        date: tx.date ? new Date(tx.date).toISOString() : new Date().toISOString(),
        notes: null,
        remarks: null,
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
                        cards={cards} 
                        accounts={[]}
                        categories={categories} 
                        initialTransactions={mapped}
                    />
            </div>
            <FloatingAddButton cards={cards} categories={categories} />
        </div>
    )
}
