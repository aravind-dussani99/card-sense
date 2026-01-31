"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AddAccountDialog } from "@/components/add-account-dialog";
import { AddCardDialog } from "@/components/add-card-dialog";
import { BankAccountsList } from "@/components/bank-accounts-list";
import { CardDisplay } from "@/components/card-display";
import { EditCardDialog } from "@/components/edit-card-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard as CardIcon, Eye, EyeOff } from "lucide-react";
import { BankAccount, Card as CardModel } from "@/lib/types";
import { useBalanceVisibility } from "@/lib/balance-visibility";

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

const getSectionFromHash = (): VisibleSection => {
    if (typeof window === "undefined") {
        return "all";
    }
    const hash = window.location.hash;
    if (hash === "#bank-accounts") return "bank";
    if (hash === "#overdraft-accounts") return "overdraft";
    if (hash === "#credit-cards") return "credit";
    return "all";
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
    const overdraftAccounts = useMemo(() => bankAccounts.filter(isOverdraft), [bankAccounts]);
    const cardAccounts = useMemo(
        () =>
            bankAccounts.filter((acct) => {
                const type = (acct.type || "").toLowerCase();
                return type.includes("card") || type.includes("credit");
            }),
        [bankAccounts]
    );
    const standardAccounts = useMemo(
        () =>
            bankAccounts.filter((acct) => {
                const type = (acct.type || "").toLowerCase();
                return !isOverdraft(acct) && !type.includes("card") && !type.includes("credit");
            }),
        [bankAccounts]
    );
    const hasBankAccounts = standardAccounts.length > 0;
    const hasOverdraftAccounts = overdraftAccounts.length > 0;
    const hasCreditCards = cards.length > 0 || cardAccounts.length > 0;
    const initialSection = getSectionFromHash();

    const [showBank, setShowBank] = useState(() => {
        if (initialSection === "bank") return hasBankAccounts;
        if (initialSection !== "all") return false;
        return hasBankAccounts;
    });
    const [showOverdraft, setShowOverdraft] = useState(() => {
        if (initialSection === "overdraft") return hasOverdraftAccounts;
        if (initialSection !== "all") return false;
        return !hasBankAccounts && hasOverdraftAccounts;
    });
    const [showCredit, setShowCredit] = useState(() => {
        if (initialSection === "credit") return hasCreditCards;
        if (initialSection !== "all") return false;
        return !hasBankAccounts && hasCreditCards;
    });

    useEffect(() => {
        const handleHashChange = () => {
            const section = getSectionFromHash();
            if (section === "bank" && hasBankAccounts) {
                setShowBank(true);
            } else if (section === "overdraft" && hasOverdraftAccounts) {
                setShowOverdraft(true);
            } else if (section === "credit" && hasCreditCards) {
                setShowCredit(true);
            }
        };
        window.addEventListener("hashchange", handleHashChange);
        return () => window.removeEventListener("hashchange", handleHashChange);
    }, [hasBankAccounts, hasOverdraftAccounts, hasCreditCards]);

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
    const cardAccountLimit = cardAccounts.reduce((sum, acct) => sum + toNumber(acct.limit), 0);
    const cardAccountUsed = cardAccounts.reduce((sum, acct) => {
        if (typeof acct.limit === "number" && typeof acct.availableBalance === "number") {
            return sum + Math.max(0, acct.limit - acct.availableBalance);
        }
        if (typeof acct.balance === "number") return sum + Math.max(0, acct.balance);
        return sum;
    }, 0);
    const manualCardLimit = cards.reduce((sum, card) => sum + toNumber(card.limit), 0);
    const manualCardUsed = cards.reduce((sum, card) => sum + toNumber(card.balance), 0);
    const creditLimit = manualCardLimit + cardAccountLimit;
    const creditUsed = manualCardUsed + cardAccountUsed;
    const creditAvailable = Math.max(0, creditLimit - creditUsed);
    const visibility = useBalanceVisibility();
    const hidden = !visibility.visible;
    const formatMoney = (value: number) => (hidden ? "•••" : `£${value.toFixed(2)}`);

    const showBankSection = showBank && hasBankAccounts;
    const showOverdraftSection = showOverdraft && hasOverdraftAccounts;
    const showCreditSection = showCredit && hasCreditCards;
    const anySectionVisible = showBankSection || showOverdraftSection || showCreditSection;

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
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => visibility.toggle()}
                        aria-label={hidden ? "Show balances" : "Hide balances"}
                    >
                        {hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                    <AddCardDialog />
                    <AddAccountDialog />
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setShowBank(true)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") setShowBank(true);
                    }}
                    className="outline-none"
                >
                    <Card className="cursor-pointer transition-colors hover:border-primary/40">
                        <CardHeader className="pb-1 pt-3">
                            <CardTitle className="text-xs font-medium uppercase tracking-wide">Bank Accounts</CardTitle>
                            <CardDescription className="text-xs">Available</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0 pb-3">
                            <div className="text-xl font-semibold">{formatMoney(bankAvailable)}</div>
                            <p className="text-xs text-muted-foreground">Across all bank accounts</p>
                        </CardContent>
                    </Card>
                </div>
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setShowOverdraft(true)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") setShowOverdraft(true);
                    }}
                    className="outline-none"
                >
                    <Card className="cursor-pointer transition-colors hover:border-primary/40">
                        <CardHeader className="pb-1 pt-3">
                            <CardTitle className="text-xs font-medium uppercase tracking-wide">Overdraft</CardTitle>
                            <CardDescription className="text-xs">Used / Available / Limit</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0 pb-3">
                            <div className="text-xl font-semibold">{formatMoney(overdraftUsed)}</div>
                            <p className="text-xs text-muted-foreground">
                                {formatMoney(overdraftAvailable)} avail · {formatMoney(overdraftLimit)} limit
                            </p>
                        </CardContent>
                    </Card>
                </div>
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setShowCredit(true)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") setShowCredit(true);
                    }}
                    className="outline-none"
                >
                    <Card className="cursor-pointer transition-colors hover:border-primary/40">
                        <CardHeader className="pb-1 pt-3">
                            <CardTitle className="text-xs font-medium uppercase tracking-wide">Credit Cards</CardTitle>
                            <CardDescription className="text-xs">Used / Available / Limit</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0 pb-3">
                            <div className="text-xl font-semibold">{formatMoney(creditUsed)}</div>
                            <p className="text-xs text-muted-foreground">
                                {formatMoney(creditAvailable)} avail · {formatMoney(creditLimit)} limit
                            </p>
                        </CardContent>
                    </Card>
                </div>
                <Link href="/rewards" className="outline-none">
                    <Card className="cursor-pointer transition-colors hover:border-primary/40">
                        <CardHeader className="pb-1 pt-3">
                            <CardTitle className="text-xs font-medium uppercase tracking-wide">Total Rewards</CardTitle>
                            <CardDescription className="text-xs">Rewards summary</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0 pb-3">
                            <div className="text-xl font-semibold">0 pts</div>
                            <p className="text-xs text-muted-foreground">Redeemable points</p>
                        </CardContent>
                    </Card>
                </Link>
            </div>

            <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" disabled={!hasBankAccounts} onClick={() => setShowBank((prev) => !prev)}>
                    {showBankSection ? "Hide accounts section" : "Show accounts section"}
                </Button>
                <Button variant="outline" size="sm" disabled={!hasOverdraftAccounts} onClick={() => setShowOverdraft((prev) => !prev)}>
                    {showOverdraftSection ? "Hide overdrafts section" : "Show overdrafts section"}
                </Button>
                <Button variant="outline" size="sm" disabled={!hasCreditCards} onClick={() => setShowCredit((prev) => !prev)}>
                    {showCreditSection ? "Hide credit cards section" : "Show credit cards section"}
                </Button>
            </div>

            {!anySectionVisible && (
                <p className="text-sm text-muted-foreground">No account data yet. Add an account or card to get started.</p>
            )}

            {showBankSection && (
                <Card id="bank-accounts" className="scroll-mt-24">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Bank Accounts</CardTitle>
                            <CardDescription>Manual accounts and connected bank accounts.</CardDescription>
                        </div>
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

            {showOverdraftSection && (
                <Card id="overdraft-accounts" className="scroll-mt-24">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Overdraft Accounts</CardTitle>
                            <CardDescription>Overdraft balances and limits grouped here.</CardDescription>
                        </div>
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

            {showCreditSection && (
                <Card id="credit-cards" className="scroll-mt-24">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Credit Cards</CardTitle>
                            <CardDescription>Track all credit card balances and limits.</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {cardAccounts.length > 0 && (
                            <div className="mb-4">
                                <BankAccountsList bankAccounts={cardAccounts} />
                            </div>
                        )}
                        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                            {cards.map((card) => {
                                const displayCard = {
                                    id: card.id,
                                    name: card.name || "Card",
                                    nameOnCard: null,
                                    bank: card.bank || "Bank",
                                    cardType: card.cardTypeId ? { name: card.cardTypeId } : null,
                                    cardCategory: null,
                                    last4: card.last4 || "••••",
                                    fullCardNumber: null,
                                    expiryDate: null,
                                    cvv: null,
                                    limit: typeof card.limit === "number" ? card.limit : 0,
                                    balance: typeof card.balance === "number" ? card.balance : 0,
                                    cutoffDate: card.cutoffDate || 1,
                                    dueDate: card.dueDate || 1,
                                    color: card.color || "bg-gray-800",
                                    last3DueDates: null,
                                };
                                const editCard = {
                                    id: displayCard.id,
                                    name: displayCard.name,
                                    nameOnCard: displayCard.nameOnCard,
                                    bank: displayCard.bank,
                                    bankId: card.bankId || null,
                                    last4: displayCard.last4,
                                    fullCardNumber: displayCard.fullCardNumber,
                                    expiryDate: displayCard.expiryDate,
                                    cvv: displayCard.cvv,
                                    cardTypeId: card.cardTypeId || null,
                                    cardType: displayCard.cardType
                                        ? { id: card.cardTypeId || displayCard.cardType.name, name: displayCard.cardType.name }
                                        : null,
                                    limit: displayCard.limit,
                                    balance: displayCard.balance,
                                    cutoffDate: displayCard.cutoffDate,
                                    dueDate: displayCard.dueDate,
                                    color: displayCard.color,
                                    statementPassword: null,
                                    cardCategory: displayCard.cardCategory,
                                };
                                return (
                                    <div key={card.id} className="relative w-full">
                                        <div className="absolute left-3 top-3 text-gray-500">
                                            <CardIcon className="h-4 w-4" />
                                        </div>
                                        <CardDisplay card={displayCard} />
                                        <div className="absolute bottom-4 right-4">
                                            <EditCardDialog card={editCard} triggerVariant="icon" />
                                        </div>
                                    </div>
                                );
                            })}
                            {cards.length + cardAccounts.length < 4 &&
                                Array.from({ length: 4 - (cards.length + cardAccounts.length) }).map((_, idx) => (
                                    <PlaceholderTile key={`card-placeholder-${idx}`} label="Credit card" />
                                ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
