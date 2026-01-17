import { Metadata } from "next";
import { MainNav } from "@/components/main-nav";
import { EmailSendersList } from "@/components/email-senders-list";
import { getOffersBySender } from "@/app/actions/offer-actions";
import { getCards } from "@/app/actions/card-actions";
import { getCategories } from "@/app/actions/category-actions";

export const metadata: Metadata = {
    title: "Email Senders - CardSense",
    description: "Track and manage offer emails by sender",
};

export default async function EmailSendersPage() {
    const senderStats = await getOffersBySender();
    const cards = await getCards();
    const categories = await getCategories();

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
                        <h2 className="text-3xl font-bold tracking-tight">Email Senders</h2>
                        <p className="text-muted-foreground mt-1">
                            Track offer emails by sender. Unsubscribe if emails exceed acceptable limits.
                        </p>
                    </div>
                </div>
                <EmailSendersList initialStats={senderStats} />
            </div>
        </div>
    );
}
