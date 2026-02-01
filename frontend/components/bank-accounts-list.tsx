"use client";

import { useState } from "react";
import { Landmark, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { ViewAccountDialog } from "@/components/view-account-dialog";

type BankAccountDisplay = {
    id: string;
    name?: string | null;
    type?: string | null;
    currency?: string | null;
    providerAccountId?: string | null;
    mask?: string | null;
    accountNumber?: string | null;
    sortCode?: string | null;
    statementBalance?: number | null;
    statementDate?: string | null;
    statementDueDate?: string | null;
    statementPaidAmount?: number | null;
    statementPaidComputed?: number | null;
    statementPayable?: number | null;
    statementDueInDays?: number | null;
    tags?: string | null;
    connection?: { institutionId?: string | null; provider?: string | null } | null;
    balance?: number | null;
    availableBalance?: number | null;
    limit?: number | null;
};

export function BankAccountsList({
    bankAccounts,
    context = "bank",
}: {
    bankAccounts: BankAccountDisplay[];
    context?: "bank" | "overdraft" | "card";
}) {
    const [list, setList] = useState(bankAccounts);
    const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [loadingId, setLoadingId] = useState<string | null>(null);

    const deleteAccount = async (id: string, label: string) => {
        setLoadingId(id);
        setFeedback(null);
        try {
            await apiFetch(`/api/bank/accounts/${id}`, { method: "DELETE", skipJson: true });
            setList((prev) => prev.filter((acct) => acct.id !== id));
            setFeedback({ type: "success", message: `${label} removed.` });
        } catch (err) {
            setFeedback({ type: "error", message: getErrorMessage(err, "Failed to delete") });
        } finally {
            setLoadingId(null);
        }
    };

    const getBankLabel = (acct: BankAccountDisplay) => {
        if (acct.connection?.institutionId) return acct.connection.institutionId;
        if (acct.connection?.provider) return acct.connection.provider;
        if (acct.tags?.startsWith("bank:")) return acct.tags.replace("bank:", "");
        return "Bank";
    };

    const deriveUkAccountDetails = (value: string) => {
        const cleaned = value.replace(/\s+/g, "");
        const match = cleaned.match(/^GB\d{2}[A-Z]{4}(\d{6})(\d{8})$/i);
        if (!match) return { sortCode: "", accountNumber: "" };
        return { sortCode: match[1], accountNumber: match[2] };
    };

    return (
        <div className="space-y-3">
            {feedback && (
                <Alert variant={feedback.type === "success" ? "default" : "destructive"}>
                    <AlertTitle>{feedback.type === "success" ? "Success" : "Error"}</AlertTitle>
                    <AlertDescription>{feedback.message}</AlertDescription>
                </Alert>
            )}
            <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                {list.map((acct) => {
                    const limitValue = typeof acct.limit === "number" ? acct.limit : null;
                    const label = acct.name || acct.type || "Account";
                    const bankLabel = getBankLabel(acct);
                    const derived = !acct.accountNumber && !acct.sortCode && acct.mask ? deriveUkAccountDetails(acct.mask) : null;
                    const accountNumber = acct.accountNumber || derived?.accountNumber || "";
                    const sortCode = acct.sortCode || derived?.sortCode || "";
                    const formattedSortCode =
                        sortCode && sortCode.length === 6
                            ? `${sortCode.slice(0, 2)}-${sortCode.slice(2, 4)}-${sortCode.slice(4)}`
                            : sortCode;
                    const typeValue = (acct.type || "").toLowerCase();
                    const isCard = context === "card" ? true : context === "bank" ? false : typeValue.includes("card") || typeValue.includes("credit");
                    const isOverdraft =
                        context === "overdraft"
                            ? true
                            : context === "bank"
                                ? false
                                : !isCard && (typeValue.includes("overdraft") || (acct.limit ?? 0) > 0);
                    const overdraftUsed =
                        isOverdraft && limitValue !== null
                            ? Math.max(0, limitValue - (typeof acct.availableBalance === "number" ? acct.availableBalance : limitValue))
                            : null;
                    const overdraftRemaining =
                        isOverdraft && limitValue !== null
                            ? Math.max(0, limitValue - (overdraftUsed ?? 0))
                            : null;
                    let bankBaseBalance: number | null = null;
                    if (context === "bank") {
                        if (typeof acct.availableBalance === "number" && limitValue !== null && limitValue > 0) {
                            bankBaseBalance = acct.availableBalance - limitValue;
                        } else if (typeof acct.balance === "number") {
                            bankBaseBalance = acct.balance;
                        } else if (typeof acct.availableBalance === "number") {
                            bankBaseBalance = acct.availableBalance;
                        }
                    }
                    const balanceValue =
                        isOverdraft && limitValue !== null
                            ? overdraftRemaining
                            : bankBaseBalance ?? acct.availableBalance ?? acct.balance ?? null;
                    const balanceText = balanceValue === null ? "—" : balanceValue.toFixed(2);
                    const cardMask = acct.mask || accountNumber.slice(-4) || "••••";
                    const accountRef = isCard
                        ? `Card •••• ${cardMask}`
                        : accountNumber
                            ? `${formattedSortCode ? `Sort ${formattedSortCode} · ` : ""}Acc ${accountNumber}`
                            : acct.mask || acct.providerAccountId || "••••";
                    const typeLabel =
                        context === "overdraft"
                            ? "Overdraft account"
                            : context === "card"
                                ? "Credit card"
                                : "Bank account";
                    const statementBalance = typeof acct.statementBalance === "number" ? acct.statementBalance : null;
                    const statementPaid =
                        typeof acct.statementPaidComputed === "number"
                            ? acct.statementPaidComputed
                            : typeof acct.statementPaidAmount === "number"
                                ? acct.statementPaidAmount
                                : null;
                    const statementPayable =
                        typeof acct.statementPayable === "number"
                            ? acct.statementPayable
                            : statementBalance !== null
                                ? Math.max(0, statementBalance - (statementPaid ?? 0))
                                : null;
                    return (
                        <div key={acct.id} className="p-3 rounded-lg border shadow-sm flex flex-col gap-2 w-full">
                            <div className="text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                    <Landmark className="h-4 w-4" />
                                    {bankLabel}
                                </span>
                            </div>
                            <div className="flex items-start justify-between gap-2">
                                <div className="text-base font-semibold">{label}</div>
                                <div className="flex gap-2">
                                    <ViewAccountDialog account={acct} triggerVariant="icon" />
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8 rounded-full text-red-600 border-red-200 hover:bg-red-50"
                                        disabled={loadingId === acct.id}
                                        onClick={() => deleteAccount(acct.id, label)}
                                        aria-label="Delete account"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            <div className="text-xs text-muted-foreground break-all">
                                {acct.currency || "—"} · {accountRef}
                                <span className="ml-2 text-[11px] uppercase tracking-wide font-semibold text-slate-500">
                                    {typeLabel}
                                </span>
                            </div>
                            <div className="text-sm font-semibold">
                                {isCard
                                    ? "Available credit"
                                    : isOverdraft
                                        ? "Overdraft available"
                                        : "Available balance"}: {balanceText}
                            </div>
                            {limitValue !== null && context !== "bank" && (
                                <div className="text-xs text-muted-foreground space-y-1">
                                    {isOverdraft ? (
                                        <div className="flex flex-wrap gap-2">
                                            <span>Limit: {limitValue.toFixed(2)}</span>
                                            <span>Used: {overdraftUsed === null ? "—" : overdraftUsed.toFixed(2)}</span>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex flex-wrap gap-2">
                                                <span>{isCard ? "Credit limit" : "Limit"}: {limitValue.toFixed(2)}</span>
                                                {isCard && (
                                                    <span>
                                                        Used:{" "}
                                                        {typeof acct.availableBalance === "number"
                                                            ? Math.max(0, limitValue - acct.availableBalance).toFixed(2)
                                                            : "—"}
                                                    </span>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                            {isCard && (
                                <div className="text-xs text-muted-foreground space-y-1">
                                    <div className="flex flex-wrap gap-2">
                                        <span>Statement: {statementBalance === null ? "—" : statementBalance.toFixed(2)}</span>
                                        <span>Paid: {statementPaid === null ? "—" : statementPaid.toFixed(2)}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <span>Payable: {statementPayable === null ? "—" : statementPayable.toFixed(2)}</span>
                                        <span>
                                            Due in:{" "}
                                            {acct.statementDueInDays !== null && acct.statementDueInDays !== undefined
                                                ? `${acct.statementDueInDays} days`
                                                : "—"}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
