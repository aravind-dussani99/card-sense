import { Metadata } from "next"
import { MainNav } from "@/components/main-nav"
import { AddCardDialog } from "@/components/add-card-dialog"
import { AddAccountDialog } from "@/components/add-account-dialog"
import { EditCardDialog } from "@/components/edit-card-dialog"
import { CardDisplay } from "@/components/card-display"
import { BankAccountsList } from "@/components/bank-accounts-list"
import { FloatingAddButton } from "@/components/floating-add-button"
import { getCards } from "@/app/actions/card-actions"
import { CreditCard as CardIcon } from "lucide-react"
import { getCategories } from "@/app/actions/category-actions"
import { getBankAccounts } from "@/app/actions/bank-actions"

export const metadata: Metadata = {
    title: "Cards & Accounts - CardSense",
    description: "Manage your credit cards and bank accounts.",
}

export default async function CardsPage() {
    const cards: any[] = await getCards();
    const categories = await getCategories();
    const bankAccounts: any[] = await getBankAccounts();

    return (
        <div className="flex flex-col min-h-screen">
            <div className="border-b bg-white/80 backdrop-blur-md shadow-sm">
                <div className="flex h-16 items-center px-4">
                    <h1 className="text-xl font-bold mr-8 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">CardSense</h1>
                    <MainNav className="mx-6" />
                </div>
            </div>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex items-center justify-between space-y-2">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Cards & Accounts</h2>
                        <p className="text-muted-foreground mt-1">
                            Manage your credit cards and bank accounts
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <AddCardDialog />
                        <AddAccountDialog />
                    </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {cards.map((card) => (
                        <div key={card.id} className="relative">
                            <div className="absolute left-3 top-3 text-gray-500">
                                <CardIcon className="h-4 w-4" />
                            </div>
                            <CardDisplay card={card} />
                            <div className="absolute bottom-4 right-4">
                                <EditCardDialog card={card} />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-8 space-y-3">
                    <div>
                        <h3 className="text-xl font-semibold">Bank Accounts</h3>
                        <p className="text-sm text-muted-foreground">
                            Manual accounts and connected bank accounts live here.
                        </p>
                    </div>
                    {bankAccounts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No bank accounts yet.</p>
                    ) : (
                        <BankAccountsList bankAccounts={bankAccounts} />
                    )}
                </div>
            </div>
            <FloatingAddButton cards={cards} categories={categories} />
        </div>
    )
}
