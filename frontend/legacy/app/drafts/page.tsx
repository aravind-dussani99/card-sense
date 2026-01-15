import { Metadata } from "next";
import { MainNav } from "@/components/main-nav";
import { DraftTransactionsList } from "@/components/draft-transactions-list";
import { getPendingDraftTransactions } from "@/app/actions/draft-transaction-actions";
import { getCards } from "@/app/actions/card-actions";
import { getCategories } from "@/app/actions/category-actions";
import { FloatingAddButton } from "@/components/floating-add-button";
import { getProcessingHistory } from "@/app/actions/email-processor-actions";
import { EmailRetriever } from "@/components/email-retriever";
import { prisma } from "@/lib/prisma";
import { BankSyncPanel } from "@/components/bank-sync-panel";

export const metadata: Metadata = {
    title: "Draft Transactions - CardSense",
    description: "Review and approve transactions extracted from emails",
};

export default async function DraftsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
    const params = await searchParams;
    const currentPage = Number(params?.page || 1);
    const { drafts, total, page, pageSize } = await getPendingDraftTransactions(currentPage, 50);
    const cards = await getCards();
    const categories = await getCategories();
    const processingHistory = await getProcessingHistory();
    const bankAccounts = await prisma.bankAccount.findMany({
        include: { connection: true, transactions: { select: { date: true } } },
    });
    const accountSummaries = bankAccounts.map((acct) => {
        const dates = acct.transactions.map((t) => t.date);
        const min = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
        const max = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
        const days = Math.floor((Date.now() - new Date(acct.connection?.createdAt || new Date()).getTime()) / (1000 * 60 * 60 * 24));
        const expired = days >= 90;
        return {
            id: acct.id,
            name: acct.name,
            type: acct.type,
            currency: acct.currency,
            mask: acct.mask,
            connectionCreatedAt: acct.connection?.createdAt?.toISOString() || null,
            dateRange: {
                min: min ? min.toISOString().split("T")[0] : undefined,
                max: max ? max.toISOString().split("T")[0] : undefined,
            },
            expired,
        };
    });

    return (
        <div className="flex flex-col min-h-screen">
            <div className="border-b bg-white/80 backdrop-blur-md shadow-sm">
                <div className="flex h-16 items-center px-4">
                    <h1 className="text-xl font-bold mr-8 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">CardSense</h1>
                    <MainNav className="mx-6" />
                </div>
            </div>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Draft Transactions</h2>
                        <p className="text-muted-foreground mt-1">
                            Review transactions extracted from emails or bank sync. Approve, modify, or reject them.
                        </p>
                    </div>
                    {drafts.length > 0 && (
                        <div className="flex items-center gap-2">
                            <div className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">
                                {drafts.length} pending
                            </div>
                        </div>
                    )}
                </div>
                <EmailRetriever 
                    type="both" 
                    processingHistory={processingHistory}
                />
                <BankSyncPanel accounts={accountSummaries} />
                <DraftTransactionsList 
                    initialDrafts={drafts} 
                    cards={cards} 
                    categories={categories} 
                    total={total}
                    page={page}
                    pageSize={pageSize}
                />
            </div>
            <FloatingAddButton cards={cards} categories={categories} />
        </div>
    );
}
