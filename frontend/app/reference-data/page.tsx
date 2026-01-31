import { Metadata } from "next"
import { MainNav } from "@/components/main-nav"
import { AuthMenu } from "@/components/auth-menu"
import { ReferenceDataManager } from "@/components/reference-data-manager"
import { getCardTypes } from "@/app/actions/card-type-actions"
import { getBanks } from "@/app/actions/bank-actions"
import { getCategories } from "@/app/actions/category-actions"

export const metadata: Metadata = {
    title: "Reference Data - CardSense",
    description: "Manage reference data including card types, banks, categories, and sub-categories.",
}

export default async function ReferenceDataPage() {
    const [cardTypes, banks, categories] = await Promise.all([
        getCardTypes(),
        getBanks(),
        getCategories(),
    ]);

    return (
        <div className="flex flex-col min-h-screen">
            <div className="border-b bg-white/80 backdrop-blur-md shadow-sm">
                <div className="flex h-16 items-center px-4">
                    <h1 className="text-xl font-bold mr-8 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">CardSense</h1>
                    <MainNav className="mx-6" />
                    <div className="ml-auto flex items-center gap-3">
                        <AuthMenu />
                    </div>
                </div>
            </div>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <ReferenceDataManager
                    initialCardTypes={cardTypes}
                    initialBanks={banks}
                    initialCategories={categories}
                />
            </div>
        </div>
    )
}
