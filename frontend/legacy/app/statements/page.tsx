import { Metadata } from "next";
import { MainNav } from "@/components/main-nav";
import { StatementsList } from "@/components/statements-list";
import { getProcessedStatements } from "@/app/actions/statement-actions";
import { getCards } from "@/app/actions/card-actions";

export const metadata: Metadata = {
    title: "Statements - CardSense",
    description: "View and manage bank statements",
};

export default async function StatementsPage() {
    const statements = await getProcessedStatements();
    const cards = await getCards();

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
                        <h2 className="text-3xl font-bold tracking-tight">Bank Statements</h2>
                        <p className="text-muted-foreground mt-1">
                            View processed statements and upload new ones manually
                        </p>
                    </div>
                </div>
                <StatementsList initialStatements={statements} cards={cards} />
            </div>
        </div>
    );
}

