import { Metadata } from "next";
import { MainNav } from "@/components/main-nav";
import { SyncWorkbench } from "@/components/sync-workbench/workbench";
import { getCategories } from "@/app/actions/category-actions";
import { getCards } from "@/app/actions/card-actions";
import { getBankAccounts } from "@/app/actions/bank-actions";

export const metadata: Metadata = {
    title: "Sync Workbench - CardSense",
    description: "Review and reconcile Open Banking transactions.",
};

export default async function SyncWorkbenchPage() {
    const [accounts, cards, categories] = await Promise.all([
        getBankAccounts(),
        getCards(),
        getCategories(),
    ]);

    return (
        <div className="flex flex-col min-h-screen bg-slate-50">
            <div className="border-b bg-white/80 backdrop-blur-md shadow-sm">
                <div className="flex h-16 items-center px-4">
                    <h1 className="text-xl font-bold mr-8 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                        CardSense
                    </h1>
                    <MainNav className="mx-6" />
                </div>
            </div>
            <div className="mx-auto w-full max-w-7xl px-6 py-10 flex-1">
                <SyncWorkbench
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
        </div>
    );
}
