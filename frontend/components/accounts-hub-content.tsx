"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AddAccountDialog } from "@/components/add-account-dialog";
import { AddCardDialog } from "@/components/add-card-dialog";
import { BankAccountsList } from "@/components/bank-accounts-list";
import { CardDisplay } from "@/components/card-display";
import { EditCardDialog } from "@/components/edit-card-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard as CardIcon } from "lucide-react";
import { BankAccount, Card as CardModel } from "@/lib/types";

type VisibleSection = "all" | "bank" | "overdraft" | "credit";

interface AccountsHubContentProps {
    cards: CardModel[];
    bankAccounts: BankAccount[];
}

const toNumber = (value?: number | null) => (typeof value === "number" ? value : 0);

const isOverdraft = (account: BankAccount) => {
    const type = (account.type || "").toLowerCase();
    const name = (account.name || "").toLowerCase();
    return type.includes("overdraft") || name.includes("overdraft");
};

const PlaceholderTile = ({ label }: { label: string }) => (
    <div className="rounded-xl border border-dashed border-muted-foreground/30 bg-muted/20 p-5 text-muted-foreground/60 backdrop-blur-sm">
        <div className="text-xs uppercase tracking-wide">Placeholder</div>
        <div className="mt-2 text-sm font-medium">{label}</div>
        <div className="mt-4 h-3 w-2/3 rounded-full bg-muted-foreground/20 blur-[1px]" />
        <div className="mt-2 h-3 w-1/2 rounded-full bg-muted-foreground/20 blur-[1px]" />
    </div>
);

export function AccountsHubContent({ cards, bankAccounts }: AccountsHubContentProps) {
    const pathname = usePathname();
    const [visibleSection, setVisibleSection] = useState<VisibleSection>("all");

    useEffect(() => {
        const hash = window.location.hash;
        if (hash === "#bank-accounts") setVisibleSection("bank");
        else if (hash === "#overdraft-accounts") setVisibleSection("overdraft");
        else if (hash === "#credit-cards") setVisibleSection("credit");
        else setVisibleSection("all");
    }, [pathname]);

    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash;
            if (hash === "#bank-accounts") setVisibleSection("bank");
            else if (hash === "#overdraft-accounts") setVisibleSection("overdraft");
            else if (hash === "#credit-cards") setVisibleSection("credit");
            else setVisibleSection("all");
        };
        window.addEventListener("hashchange", handleHashChange);
        return () => window.removeEventListener("hashchange", handleHashChange);
    }, []);

    const overdraftAccounts = useMemo(() => bankAccounts.filter(isOverdraft), [bankAccounts]);
    const standardAccounts = useMemo(() => bankAccounts.filter((acct) => !isOverdraft(acct)), [bankAccounts]);

    const bankAvailable = standardAccounts.reduce(
        (sum, acct) => sum + toNumber(acct.availableBalance ?? acct.balance),
        0
    );
    const overdraftLimit = overdraftAccounts.reduce((sum, acct) => sum + toNumber(acct.limit), 0);
    const overdraftAvailable = overdraftAccounts.reduce(
        (sum, acct) => sum + toNumber(acct.availableBalance ?? acct.balance),
        0
    );
    const overdraftUsed = Math.max(0, overdraftLimit - overdraftAvailable);
    const creditLimit = cards.reduce((sum, card) => sum + toNumber(card.limit), 0);
    const creditUsed = cards.reduce((sum, card) => sum + toNumber(card.balance), 0);
    const creditAvailable = Math.max(0, creditLimit - creditUsed);

    const showBank = visibleSection === "all" || visibleSection === "bank";
    const showOverdraft = visibleSection === "all" || visibleSection === "overdraft";
    const showCredit = visibleSection === "all" || visibleSection === "credit";

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Accounts Hub</h2>
                    <p className="text-muted-foreground mt-1">
                        Manage your bank accounts, overdrafts, and credit cards
                    </p>
                </div>
                <div className="flex gap-2">
                    <AddCardDialog />
                    <AddAccountDialog />
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setVisibleSection("bank")}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") setVisibleSection("bank");
                    }}
                    className="outline-none"
                >
                    <Card className="cursor-pointer transition-colors hover:border-primary/40">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Bank Accounts</CardTitle>
                        <CardDescription>Available</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">£{bankAvailable.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">Across all bank accounts</p>
                    </CardContent>
                    </Card>
                </div>
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setVisibleSection("overdraft")}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") setVisibleSection("overdraft");
                    }}
                    className="outline-none"
                >
                    <Card className="cursor-pointer transition-colors hover:border-primary/40">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Overdraft</CardTitle>
                        <CardDescription>Used / Available / Limit</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">£{overdraftUsed.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">
                            £{overdraftAvailable.toFixed(2)} avail · £{overdraftLimit.toFixed(2)} limit
                        </p>
                    </CardContent>
                    </Card>
                </div>
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setVisibleSection("credit")}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") setVisibleSection("credit");
                    }}
                    className="outline-none"
                >
                    <Card className="cursor-pointer transition-colors hover:border-primary/40">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Credit Cards</CardTitle>
                        <CardDescription>Used / Available / Limit</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">£{creditUsed.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">
                            £{creditAvailable.toFixed(2)} avail · £{creditLimit.toFixed(2)} limit
                        </p>
                    </CardContent>
                    </Card>
                </div>
                <Link href="/rewards" className="outline-none">
                    <Card className="cursor-pointer transition-colors hover:border-primary/40">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Rewards</CardTitle>
                        <CardDescription>Rewards summary</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">0 pts</div>
                        <p className="text-xs text-muted-foreground">Redeemable points</p>
                    </CardContent>
                    </Card>
                </Link>
            </div>

            {visibleSection !== "all" && (
                <div>
                    <Button variant="outline" onClick={() => setVisibleSection("all")}>
                        Show all sections
                    </Button>
                </div>
            )}

            {showBank && (
                <Card id="bank-accounts" className="scroll-mt-24">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Bank Accounts</CardTitle>
                            <CardDescription>Manual accounts and connected bank accounts.</CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setVisibleSection("bank")}>
                            Hide other sections
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {standardAccounts.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No bank accounts yet.</p>
                        ) : (
                            <BankAccountsList bankAccounts={standardAccounts} />
                        )}
                    </CardContent>
                </Card>
            )}

            {showOverdraft && (
                <Card id="overdraft-accounts" className="scroll-mt-24">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Overdraft Accounts</CardTitle>
                            <CardDescription>Overdraft balances and limits grouped here.</CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setVisibleSection("overdraft")}>
                            Hide other sections
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {overdraftAccounts.length === 0 ? (
                            <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                                {Array.from({ length: 4 }).map((_, idx) => (
                                    <PlaceholderTile key={idx} label="Overdraft account" />
                                ))}
                            </div>
                        ) : (
                            <>
                                <BankAccountsList bankAccounts={overdraftAccounts} />
                                {overdraftAccounts.length < 4 && (
                                    <div className="mt-3 grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                                        {Array.from({ length: 4 - overdraftAccounts.length }).map((_, idx) => (
                                            <PlaceholderTile key={`overdraft-placeholder-${idx}`} label="Overdraft account" />
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>
            )}

            {showCredit && (
                <Card id="credit-cards" className="scroll-mt-24">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Credit Cards</CardTitle>
                            <CardDescription>Track all credit card balances and limits.</CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setVisibleSection("credit")}>
                            Hide other sections
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                            {cards.map((card) => (
                                <div key={card.id} className="relative w-full">
                                    <div className="absolute left-3 top-3 text-gray-500">
                                        <CardIcon className="h-4 w-4" />
                                    </div>
                                    <CardDisplay card={card} />
                                    <div className="absolute bottom-4 right-4">
                                        <EditCardDialog card={card} />
                                    </div>
                                </div>
                            ))}
                            {cards.length < 4 &&
                                Array.from({ length: 4 - cards.length }).map((_, idx) => (
                                    <PlaceholderTile key={`card-placeholder-${idx}`} label="Credit card" />
                                ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
