import { Metadata } from "next";
import { MainNav } from "@/components/main-nav";
import { OffersList } from "@/components/offers-list";
import { getAllOffers } from "@/app/actions/offer-actions";
import { getCards } from "@/app/actions/card-actions";
import { getCategories } from "@/app/actions/category-actions";
import { prisma } from "@/lib/prisma";
import { FloatingAddButton } from "@/components/floating-add-button";
import { getProcessingHistory } from "@/app/actions/email-processor-actions";
import { EmailRetriever } from "@/components/email-retriever";
import { matchOffers } from "@/lib/offers-matcher";

export const metadata: Metadata = {
    title: "Offers - CardSense",
    description: "View and manage credit card offers",
};

export default async function OffersPage() {
    const offers = await getAllOffers();
    const cards = await getCards();
    const categories = await getCategories();
    const processingHistory = await getProcessingHistory();
    const recentTx = await prisma.bankTransaction.findMany({
        where: { date: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
        select: { category: true, amount: true, account: { select: { connection: { select: { provider: true, institutionId: true } } } } },
    });
    const accounts = await prisma.bankAccount.findMany({
        include: { connection: { select: { provider: true, institutionId: true } } },
    });

    const spendByCategory = recentTx.reduce<Record<string, number>>((acc, tx) => {
        const key = (tx.category || "general").toLowerCase();
        acc[key] = (acc[key] || 0) + Math.abs(tx.amount || 0);
        return acc;
    }, {});

    const matchedOffers = matchOffers({
        cards: cards.map((c) => ({
            network: c.cardType?.name || c.cardCategory,
            issuer: c.bank,
        })),
        accounts: accounts.map((a) => ({
            issuer: a.connection?.institutionId || a.connection?.provider || null,
        })),
        spend: spendByCategory,
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
                        <h2 className="text-3xl font-bold tracking-tight">Card Offers</h2>
                        <p className="text-muted-foreground mt-1">
                            View active offers and savings opportunities from your cards
                        </p>
                    </div>
                </div>
                <EmailRetriever 
                    type="offers" 
                    processingHistory={processingHistory}
                />
                {matchedOffers.length > 0 && (
                    <div className="rounded-lg border bg-white p-4 space-y-3">
                        <div>
                            <h3 className="text-xl font-semibold">Suggested offers (beta)</h3>
                            <p className="text-sm text-muted-foreground">
                                Based on your connected cards/accounts and recent spend. Network/issuer matching only; we avoid storing full PANs.
                            </p>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                            {matchedOffers.map((offer) => (
                                <div key={offer.id} className="border rounded-md p-3 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <div className="font-semibold">{offer.title}</div>
                                        <span className="text-xs text-muted-foreground">{offer.network || offer.issuer || "General"}</span>
                                    </div>
                                    <div className="text-sm">{offer.description}</div>
                                    <div className="text-xs text-muted-foreground">{offer.rewardText}</div>
                                    {offer.minSpend ? (
                                        <div className="text-xs text-muted-foreground">Min spend: £{offer.minSpend}</div>
                                    ) : null}
                                    <div className="text-xs text-muted-foreground">Reason: {offer.reason}</div>
                                    <div className="text-xs text-muted-foreground">
                                        Suggested for: {offer.suggestedFor.join(", ")}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                <OffersList initialOffers={offers} cards={cards} />
            </div>
            <FloatingAddButton cards={cards} categories={categories} />
        </div>
    );
}
