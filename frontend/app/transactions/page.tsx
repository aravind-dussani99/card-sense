import { Metadata } from "next";
import { MainNav } from "@/components/main-nav";
import { AuthMenu } from "@/components/auth-menu";
import { TransactionsList } from "@/components/transactions-list";
import { getCards } from "@/app/actions/card-actions";
import { getCategories } from "@/app/actions/category-actions";
import { getBankAccounts } from "@/app/actions/bank-actions";
import { getHeadAccounts } from "@/app/actions/head-account-actions";
import { TransactionsHeaderActions } from "@/components/transactions-header-actions";

export const metadata: Metadata = {
    title: "Transactions - CardSense",
    description: "View and manage all your transactions.",
}

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
    const [cards, categories, accounts, headAccounts] = await Promise.all([
        getCards(),
        getCategories(),
        getBankAccounts(),
        getHeadAccounts(),
    ]);

    return (
        <div className="flex flex-col min-h-screen bg-slate-50">
            <div className="border-b bg-white/80 backdrop-blur-md shadow-sm">
                <div className="flex h-16 items-center px-4">
                    <h1 className="text-xl font-bold mr-8 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">CardSense</h1>
                    <MainNav className="mx-6" />
                    <div className="ml-auto flex items-center gap-3">
                        <AuthMenu />
                    </div>
                </div>
            </div>
            <div className="mx-auto w-full max-w-7xl px-6 py-10 flex-1">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">All transactions</h1>
                        <p className="mt-1 text-base text-slate-600">
                            Sync OpenBanking Transactions, filter, review, update and add cash transactions from one place.
                        </p>
                    </div>
                    <TransactionsHeaderActions />
                </div>

                <div className="space-y-10">
                    <TransactionsList
                        cards={cards}
                        categories={categories}
                        accounts={accounts}
                        headAccounts={headAccounts}
                    />
                </div>
            </div>
        </div>
    );
}
