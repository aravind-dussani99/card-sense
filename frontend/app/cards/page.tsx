import { Metadata } from "next"
import { MainNav } from "@/components/main-nav"
import { getCards } from "@/app/actions/card-actions"
import { getBankAccounts } from "@/app/actions/bank-actions"
import { BankAccount, Card } from "@/lib/types"
import { AccountsHubContent } from "@/components/accounts-hub-content"

export const metadata: Metadata = {
    title: "Accounts Hub - CardSense",
    description: "Manage your bank accounts, overdrafts, and credit cards.",
}

export default async function CardsPage() {
    const cards: Card[] = await getCards();
    const bankAccounts: BankAccount[] = await getBankAccounts();

    return (
        <div className="flex flex-col min-h-screen">
            <div className="border-b bg-white/80 backdrop-blur-md shadow-sm">
                <div className="flex h-16 items-center px-4">
                    <h1 className="text-xl font-bold mr-8 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">CardSense</h1>
                    <MainNav className="mx-6" />
                </div>
            </div>
            <AccountsHubContent cards={cards} bankAccounts={bankAccounts} />
        </div>
    )
}
