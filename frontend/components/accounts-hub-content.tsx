"use client";

import { useEffect, useMemo, useState } from "react";
import { AddAccountDialog } from "@/components/add-account-dialog";
import { AddCardDialog } from "@/components/add-card-dialog";
import { BankAccountsList } from "@/components/bank-accounts-list";
import { CardDisplay } from "@/components/card-display";
import { ViewAccountMetaDialog } from "@/components/view-account-meta-dialog";
import { DashboardKpis } from "@/components/dashboard-kpis";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard as CardIcon, Eye, EyeOff } from "lucide-react";
import { AccountMeta, BankAccount } from "@/lib/types";
import { useBalanceVisibility } from "@/lib/balance-visibility";

interface AccountsHubContentProps {
    bankAccounts: BankAccount[];
    accountMetas: AccountMeta[];
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

export function AccountsHubContent({ bankAccounts, accountMetas }: AccountsHubContentProps) {
    const secureAccounts = useMemo(
        () =>
            accountMetas
                .filter(
                    (acct) =>
                        !acct.linkedBankAccountId &&
                        ["BANK_ACCOUNT", "OVERDRAFT", "CASH_ACCOUNT"].includes(acct.accountType)
                )
                .map((acct) => ({
                    id: acct.id,
                    name: acct.label,
                    type: acct.accountType.toLowerCase(),
                    currency: acct.currency || null,
                    providerAccountId: null,
                    mask: acct.accountNumber ? acct.accountNumber.slice(-4) : null,
                    accountNumber: acct.accountNumber || null,
                    sortCode: acct.sortCode || null,
                    balance: acct.balance ?? null,
                    availableBalance: acct.availableBalance ?? null,
                    limit: acct.limit ?? null,
                    tags: acct.bankName ? `bank:${acct.bankName}` : null,
                    source: "meta" as const,
                })),
        [accountMetas]
    );
    const mergedBankAccounts = useMemo(
        () => [
            ...bankAccounts.map((acct) => ({ ...acct, source: "bank" as const })),
            ...secureAccounts,
        ],
        [bankAccounts, secureAccounts]
    );
    const overdraftAccounts = useMemo(
        () =>
            mergedBankAccounts.filter((acct) => {
                const type = (acct.type || "").toLowerCase();
                return (acct.limit ?? 0) > 0 && !((acct.type || "").toLowerCase().includes("card") || (acct.type || "").toLowerCase().includes("credit"));
            }),
        [mergedBankAccounts]
    );
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
            mergedBankAccounts.filter((acct) => {
                const type = (acct.type || "").toLowerCase();
                return !type.includes("card") && !type.includes("credit") && !type.includes("overdraft");
            }),
        [mergedBankAccounts]
    );
    const secureCardDisplays = useMemo(
        () =>
            accountMetas
                .filter(
                    (card) =>
                        !card.linkedBankAccountId &&
                        ["CREDIT_CARD", "DEBIT_CARD", "CASH_CARD"].includes(card.accountType)
                )
                .map((card) => ({
                    id: card.id,
                    name: card.label,
                    nameOnCard: null,
                    bank: card.bankName || "Bank",
                    cardType: card.cardNetwork ? { name: card.cardNetwork } : null,
                    cardCategory: null,
                    last4: card.cardLast4 || "••••",
                    fullCardNumber: null,
                    expiryDate: null,
                    cvv: null,
                    limit: typeof card.limit === "number" ? card.limit : 0,
                    balance: typeof card.balance === "number" ? card.balance : 0,
                    cutoffDate: card.statementDay || 1,
                    dueDate: card.dueDay || 1,
                    color: "bg-gray-800",
                    last3DueDates: card.last3DueDates || null,
                })),
        [accountMetas]
    );
    const [showBank, setShowBank] = useState(true);
    const [showOverdraft, setShowOverdraft] = useState(true);
    const [showCredit, setShowCredit] = useState(true);
    const focusSection = (id: string) => {
        if (typeof window === "undefined") return;
        requestAnimationFrame(() => {
            document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    };
    const selectSection = (section: "bank" | "overdraft" | "credit") => {
        setShowBank(section === "bank");
        setShowOverdraft(section === "overdraft");
        setShowCredit(section === "credit");
        if (section === "bank") focusSection("bank-accounts");
        if (section === "overdraft") focusSection("overdraft-accounts");
        if (section === "credit") focusSection("credit-cards");
    };

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
    const manualCardLimit = secureCardDisplays.reduce((sum, card) => sum + toNumber(card.limit), 0);
    const manualCardUsed = secureCardDisplays.reduce((sum, card) => sum + toNumber(card.balance), 0);
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
                    <AddCardDialog />
                    <AddAccountDialog />
                </div>
            </div>

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
                onBankClick={() => selectSection("bank")}
                onOverdraftClick={() => selectSection("overdraft")}
                onCreditClick={() => selectSection("credit")}
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
                                        bankAccounts={cardAccounts.map((acct) => ({ ...acct, source: "bank" as const }))}
                                        context="card"
                                    />
                                </div>
                            )}
                            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                                {secureCardDisplays.map((displayCard) => (
                                    <div key={displayCard.id} className="relative w-full">
                                        <div className="absolute left-3 top-3 text-gray-500">
                                            <CardIcon className="h-4 w-4" />
                                        </div>
                                        <CardDisplay card={displayCard} />
                                        <div className="absolute bottom-4 right-4">
                                            <ViewAccountMetaDialog accountMetaId={displayCard.id} triggerVariant="icon" />
                                        </div>
                                    </div>
                                ))}
                                {(secureCardDisplays.length + cardAccounts.length) === 0 &&
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
