"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AddAccountDialog } from "@/components/add-account-dialog";
import { AddCardDialog } from "@/components/add-card-dialog";
import { BankAccountsList } from "@/components/bank-accounts-list";
import { CardDisplay } from "@/components/card-display";
import { EditCardDialog } from "@/components/edit-card-dialog";
import { DashboardKpis } from "@/components/dashboard-kpis";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard as CardIcon, Eye, EyeOff } from "lucide-react";
import { BankAccount, Card as CardModel, UserAccount, UserCard } from "@/lib/types";
import { useBalanceVisibility } from "@/lib/balance-visibility";

interface AccountsHubContentProps {
    cards: CardModel[];
    bankAccounts: BankAccount[];
    userAccounts: UserAccount[];
    userCards: UserCard[];
}

const toNumber = (value?: number | null) => (typeof value === "number" ? value : 0);

const isOverdraft = (account: BankAccount) => {
    const type = (account.type || "").toLowerCase();
    const name = (account.name || "").toLowerCase();
    const isCard = type.includes("card") || type.includes("credit");
    if (isCard) return false;
    return type.includes("overdraft") || name.includes("overdraft") || (account.limit ?? 0) > 0;
};

const PlaceholderTile = ({ label }: { label: string }) => (
    <div className="rounded-xl border border-dashed border-muted-foreground/30 bg-muted/20 p-5 text-muted-foreground/60 backdrop-blur-sm">
        <div className="text-xs uppercase tracking-wide">Placeholder</div>
        <div className="mt-2 text-sm font-medium">{label}</div>
        <div className="mt-4 h-3 w-2/3 rounded-full bg-muted-foreground/20 blur-[1px]" />
        <div className="mt-2 h-3 w-1/2 rounded-full bg-muted-foreground/20 blur-[1px]" />
    </div>
);

export function AccountsHubContent({ cards, bankAccounts, userAccounts, userCards }: AccountsHubContentProps) {
    const [dataSource, setDataSource] = useState<"legacy" | "secure">("legacy");
    const secureAccounts = useMemo(
        () =>
            userAccounts.map((acct) => ({
                id: acct.id,
                name: acct.label,
                type: acct.accountType || "bank",
                currency: acct.currency || null,
                providerAccountId: null,
                mask: acct.accountNumber ? acct.accountNumber.slice(-4) : null,
                accountNumber: acct.accountNumber || null,
                sortCode: acct.sortCode || null,
                balance: acct.balance ?? null,
                availableBalance: acct.balance ?? null,
                limit: acct.limit ?? null,
                tags: acct.bankName ? `bank:${acct.bankName}` : null,
            })),
        [userAccounts]
    );
    const activeBankAccounts = dataSource === "secure" ? secureAccounts : bankAccounts;
    const overdraftAccounts = useMemo(
        () =>
            activeBankAccounts.filter((acct) => {
                const type = (acct.type || "").toLowerCase();
                if (dataSource === "secure") return type.includes("overdraft");
                return (acct.limit ?? 0) > 0 && !((acct.type || "").toLowerCase().includes("card") || (acct.type || "").toLowerCase().includes("credit"));
            }),
        [activeBankAccounts, dataSource]
    );
    const cardAccounts = useMemo(
        () =>
            activeBankAccounts.filter((acct) => {
                const type = (acct.type || "").toLowerCase();
                return type.includes("card") || type.includes("credit");
            }),
        [activeBankAccounts]
    );
    const standardAccounts = useMemo(
        () =>
            activeBankAccounts.filter((acct) => {
                const type = (acct.type || "").toLowerCase();
                return !type.includes("card") && !type.includes("credit") && (dataSource === "secure" ? !type.includes("overdraft") : true);
            }),
        [activeBankAccounts, dataSource]
    );
    const secureCardDisplays = useMemo(
        () =>
            userCards.map((card) => ({
                id: card.id,
                name: card.label,
                nameOnCard: null,
                bank: card.issuerBankName || "Bank",
                cardType: card.network ? { name: card.network } : null,
                cardCategory: null,
                last4: card.last4 || "••••",
                fullCardNumber: null,
                expiryDate: null,
                cvv: null,
                limit: 0,
                balance: 0,
                cutoffDate: card.statementDay || 1,
                dueDate: card.dueDay || 1,
                color: "bg-gray-800",
                last3DueDates: card.last3DueDates || null,
            })),
        [userCards]
    );
    const [showBank, setShowBank] = useState(true);
    const [showOverdraft, setShowOverdraft] = useState(true);
    const [showCredit, setShowCredit] = useState(true);

    const bankAvailable = standardAccounts.reduce((sum, acct) => {
        const limit = typeof acct.limit === "number" ? acct.limit : 0;
        const available = typeof acct.availableBalance === "number" ? acct.availableBalance : null;
        const balance = typeof acct.balance === "number" ? acct.balance : null;
        const base = available !== null && limit > 0 ? available - limit : balance ?? available ?? 0;
        return sum + Math.max(0, base);
    }, 0);
    const bankPayable = standardAccounts.reduce((sum, acct) => {
        const limit = typeof acct.limit === "number" ? acct.limit : 0;
        const available = typeof acct.availableBalance === "number" ? acct.availableBalance : null;
        const balance = typeof acct.balance === "number" ? acct.balance : null;
        const base = available !== null && limit > 0 ? available - limit : balance ?? available ?? 0;
        return sum + Math.max(0, -base);
    }, 0);
    const overdraftLimit = overdraftAccounts.reduce((sum, acct) => sum + toNumber(acct.limit), 0);
    const overdraftUsed = overdraftAccounts.reduce((sum, acct) => {
        const balance = typeof acct.balance === "number" ? acct.balance : 0;
        return sum + Math.max(0, -balance);
    }, 0);
    const overdraftAvailable = Math.max(0, overdraftLimit - overdraftUsed);
    const cardAccountLimit = cardAccounts.reduce((sum, acct) => sum + toNumber(acct.limit), 0);
    const cardAccountUsed = cardAccounts.reduce((sum, acct) => {
        if (typeof acct.limit === "number" && typeof acct.availableBalance === "number") {
            return sum + Math.max(0, acct.limit - acct.availableBalance);
        }
        if (typeof acct.balance === "number") return sum + Math.max(0, acct.balance);
        return sum;
    }, 0);
    const manualCardLimit = dataSource === "secure" ? 0 : cards.reduce((sum, card) => sum + toNumber(card.limit), 0);
    const manualCardUsed = dataSource === "secure" ? 0 : cards.reduce((sum, card) => sum + toNumber(card.balance), 0);
    const creditLimit = manualCardLimit + cardAccountLimit;
    const creditUsed = manualCardUsed + cardAccountUsed;
    const creditAvailable = Math.max(0, creditLimit - creditUsed);
    const visibility = useBalanceVisibility();
    const hidden = !visibility.visible;
    const grossAvailable = bankAvailable + overdraftAvailable + creditAvailable;
    const grossPayable = bankPayable + overdraftUsed + creditUsed;
    const netAvailable = grossAvailable - grossPayable;

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
                    <Button
                        variant={dataSource === "legacy" ? "default" : "outline"}
                        onClick={() => setDataSource("legacy")}
                    >
                        TrueLayer
                    </Button>
                    <Button
                        variant={dataSource === "secure" ? "default" : "outline"}
                        onClick={() => setDataSource("secure")}
                    >
                        Secure Assets
                    </Button>
                    {dataSource === "legacy" ? (
                        <>
                            <AddCardDialog />
                            <AddAccountDialog />
                        </>
                    ) : (
                        <Link href="/secure-assets" className="inline-flex">
                            <Button variant="outline">Manage Secure Assets</Button>
                        </Link>
                    )}
                </div>
            </div>
            {dataSource === "secure" && (
                <p className="text-sm text-muted-foreground">
                    Showing user-managed assets. TrueLayer accounts are hidden in this view.
                </p>
            )}

            <DashboardKpis
                netAvailable={netAvailable}
                grossAvailable={grossAvailable}
                grossPayable={grossPayable}
                bankAvailable={bankAvailable}
                overdraftAvailable={overdraftAvailable}
                overdraftLimit={overdraftLimit}
                overdraftUsed={overdraftUsed}
                creditAvailable={creditAvailable}
                creditLimit={creditLimit}
                creditUsed={creditUsed}
            />

            <Card id="bank-accounts" className="scroll-mt-24">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Bank Accounts</CardTitle>
                        <CardDescription>Manual accounts and connected bank accounts.</CardDescription>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowBank((prev) => !prev)}
                        aria-label={showBank ? "Hide accounts section" : "Show accounts section"}
                    >
                        {showBank ? "Hide accounts section" : "Show accounts section"}
                    </Button>
                </CardHeader>
                <CardContent>
                    {showBank ? (
                        standardAccounts.length === 0 ? (
                            <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                                {Array.from({ length: 4 }).map((_, idx) => (
                                    <PlaceholderTile key={`bank-placeholder-${idx}`} label="Bank account" />
                                ))}
                            </div>
                        ) : (
                            <BankAccountsList
                                bankAccounts={standardAccounts}
                                context="bank"
                                deleteEndpoint={dataSource === "secure" ? "/api/user-accounts" : undefined}
                                showViewDialog={dataSource !== "secure"}
                            />
                        )
                    ) : (
                        <p className="text-sm text-muted-foreground">Accounts section hidden.</p>
                    )}
                </CardContent>
            </Card>

            <Card id="overdraft-accounts" className="scroll-mt-24">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Overdraft Accounts</CardTitle>
                        <CardDescription>Overdraft balances and limits grouped here.</CardDescription>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowOverdraft((prev) => !prev)}
                        aria-label={showOverdraft ? "Hide overdrafts section" : "Show overdrafts section"}
                    >
                        {showOverdraft ? "Hide overdrafts section" : "Show overdrafts section"}
                    </Button>
                </CardHeader>
                <CardContent>
                    {showOverdraft ? (
                        overdraftAccounts.length === 0 ? (
                            <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                                {Array.from({ length: 4 }).map((_, idx) => (
                                    <PlaceholderTile key={`overdraft-placeholder-${idx}`} label="Overdraft account" />
                                ))}
                            </div>
                        ) : (
                            <BankAccountsList
                                bankAccounts={overdraftAccounts}
                                context="overdraft"
                                deleteEndpoint={dataSource === "secure" ? "/api/user-accounts" : undefined}
                                showViewDialog={dataSource !== "secure"}
                            />
                        )
                    ) : (
                        <p className="text-sm text-muted-foreground">Overdrafts section hidden.</p>
                    )}
                </CardContent>
            </Card>

            <Card id="credit-cards" className="scroll-mt-24">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Credit Cards</CardTitle>
                        <CardDescription>Track all credit card balances and limits.</CardDescription>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCredit((prev) => !prev)}
                        aria-label={showCredit ? "Hide credit cards section" : "Show credit cards section"}
                    >
                        {showCredit ? "Hide credit cards section" : "Show credit cards section"}
                    </Button>
                </CardHeader>
                <CardContent>
                    {showCredit ? (
                        <>
                            {cardAccounts.length > 0 && (
                                <div className="mb-4">
                                    <BankAccountsList
                                        bankAccounts={cardAccounts}
                                        context="card"
                                        deleteEndpoint={dataSource === "secure" ? "/api/user-accounts" : undefined}
                                        showViewDialog={dataSource !== "secure"}
                                    />
                                </div>
                            )}
                            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                                {(dataSource === "secure" ? secureCardDisplays : cards.map((card) => ({
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
                                    bankId: card.bankId || null,
                                    cardTypeId: card.cardTypeId || null,
                                }))).map((displayCard) => {
                                    const editCard = {
                                        id: displayCard.id,
                                        name: displayCard.name,
                                        nameOnCard: displayCard.nameOnCard,
                                        bank: displayCard.bank,
                                        bankId: "bankId" in displayCard ? displayCard.bankId : null,
                                        last4: displayCard.last4,
                                        fullCardNumber: displayCard.fullCardNumber,
                                        expiryDate: displayCard.expiryDate,
                                        cvv: displayCard.cvv,
                                        cardTypeId: "cardTypeId" in displayCard ? displayCard.cardTypeId : null,
                                        cardType: displayCard.cardType
                                            ? { id: ("cardTypeId" in displayCard ? displayCard.cardTypeId : displayCard.cardType.name) || displayCard.cardType.name, name: displayCard.cardType.name }
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
                                        <div key={displayCard.id} className="relative w-full">
                                            <div className="absolute left-3 top-3 text-gray-500">
                                                <CardIcon className="h-4 w-4" />
                                            </div>
                                            <CardDisplay card={displayCard} />
                                            {dataSource !== "secure" && (
                                                <div className="absolute bottom-4 right-4">
                                                    <EditCardDialog card={editCard} triggerVariant="icon" />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {((dataSource === "secure" ? secureCardDisplays.length : cards.length) + cardAccounts.length) === 0 &&
                                    Array.from({ length: 4 }).map((_, idx) => (
                                        <PlaceholderTile key={`card-placeholder-${idx}`} label="Credit card" />
                                    ))}
                            </div>
                        </>
                    ) : (
                        <p className="text-sm text-muted-foreground">Credit cards section hidden.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
