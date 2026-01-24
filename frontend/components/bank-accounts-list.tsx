"use client";

import { useState } from "react";
import { Landmark } from "lucide-react";
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
    tags?: string | null;
    connection?: { institutionId?: string | null; provider?: string | null } | null;
    balance?: number | null;
    availableBalance?: number | null;
    limit?: number | null;
};

export function BankAccountsList({ bankAccounts }: { bankAccounts: BankAccountDisplay[] }) {
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

    return (
        <div className="space-y-3">
            {feedback && (
                <Alert variant={feedback.type === "success" ? "default" : "destructive"}>
                    <AlertTitle>{feedback.type === "success" ? "Success" : "Error"}</AlertTitle>
                    <AlertDescription>{feedback.message}</AlertDescription>
                </Alert>
            )}
            <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {list.map((acct) => {
                    const balanceValue = acct.availableBalance ?? acct.balance ?? null;
                    const balanceText = balanceValue === null ? "—" : balanceValue.toFixed(2);
                    const label = acct.name || acct.type || "Account";
                    const bankLabel = getBankLabel(acct);
                    const accountRef = acct.mask || acct.providerAccountId || "••••";
                    return (
                        <div key={acct.id} className="p-4 rounded-lg border shadow-sm flex flex-col gap-2 max-w-sm w-full mx-auto">
                            <div className="text-sm text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                    <Landmark className="h-4 w-4" />
                                    {bankLabel}
                                </span>
                            </div>
                            <div className="text-lg font-semibold">{label}</div>
                            <div className="text-sm text-muted-foreground break-all">
                                {acct.currency || "—"} · {accountRef}
                            </div>
                            <div className="text-sm font-semibold">
                                Balance: {balanceText}
                            </div>
                            {acct.limit !== null && acct.limit !== undefined && (
                                <div className="text-sm text-muted-foreground">
                                    Limit: {acct.limit.toFixed(2)}
                                </div>
                            )}
                            <div className="mt-2 flex gap-2">
                                <ViewAccountDialog account={acct} />
                                <Button
                                    variant="outline"
                                    className="text-red-600 border-red-200 hover:bg-red-50"
                                    disabled={loadingId === acct.id}
                                    onClick={() => deleteAccount(acct.id, label)}
                                >
                                    {loadingId === acct.id ? "Deleting…" : "Delete"}
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
