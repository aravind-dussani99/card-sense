"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface BankSyncPanelProps {
    accounts: Array<{
        id: string;
        name?: string | null;
        type?: string | null;
        currency?: string | null;
        mask?: string | null;
        connectionCreatedAt?: string | null;
        dateRange?: { min?: string; max?: string };
        expired?: boolean;
    }>;
    history?: Array<{ accountName: string; syncedAt: string; count: number }>;
    defaultAccountId?: string;
}

export function BankSyncPanel({ accounts, history = [], defaultAccountId }: BankSyncPanelProps) {
    const [accountId, setAccountId] = useState<string>(defaultAccountId || "");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");

    const selected = accounts.find((a) => a.id === accountId);

    useEffect(() => {
        if (defaultAccountId) {
            setAccountId(defaultAccountId);
        }
    }, [defaultAccountId]);

    const handleSync = async () => {
        if (!accountId) return;
        setLoading(true);
        setMessage(null);
        setError(null);
        try {
            const res = await fetch("/api/bank/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ accountId, fromDate: fromDate || undefined, toDate: toDate || undefined }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || "Sync failed");
            }
            setMessage("Synced latest transactions");
        } catch (err: any) {
            setError(err.message || "Sync failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Retrieve Transactions</CardTitle>
                <CardDescription>Select a bank account, optional date range, and sync new transactions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                        <h4 className="font-semibold text-sm">Processing History</h4>
                        <div className="space-y-2 border rounded-lg p-3 min-h-[120px]">
                            {history.length === 0 && (
                                <div className="text-sm text-muted-foreground">No syncs yet.</div>
                            )}
                            {history.map((h, idx) => (
                                <div key={idx} className="flex items-center justify-between text-sm">
                                    <div>
                                        <div className="font-medium">{h.accountName}</div>
                                        <div className="text-muted-foreground text-xs">{new Date(h.syncedAt).toLocaleString()}</div>
                                    </div>
                                    <div className="text-xs text-muted-foreground">{h.count} tx</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-3">
                        <h4 className="font-semibold text-sm">Date Range & Filters</h4>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <Label className="text-xs">From</Label>
                                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                            </div>
                            <div>
                                <Label className="text-xs">To</Label>
                                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                            </div>
                        </div>
                        <div className="flex gap-2 text-xs">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    const today = new Date();
                                    const from = new Date(today);
                                    from.setDate(from.getDate() - 7);
                                    setFromDate(from.toISOString().split("T")[0]);
                                    setToDate(today.toISOString().split("T")[0]);
                                }}
                            >
                                Last 7 days
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    const today = new Date();
                                    const from = new Date(today);
                                    from.setDate(from.getDate() - 30);
                                    setFromDate(from.toISOString().split("T")[0]);
                                    setToDate(today.toISOString().split("T")[0]);
                                }}
                            >
                                Last 30 days
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => { setFromDate(""); setToDate(""); }}>
                                Clear
                            </Button>
                        </div>
                    </div>
                </div>

                <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select bank account" />
                    </SelectTrigger>
                    <SelectContent>
                        {accounts.map((acct) => (
                            <SelectItem key={acct.id} value={acct.id}>
                                {acct.name || acct.type || "Account"} {acct.mask ? `(${acct.mask})` : ""}{" "}
                                {acct.expired ? " - Reconnect required" : ""}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {selected && (
                    <div className="text-xs text-muted-foreground space-y-1">
                        <div>
                            Status: {selected.expired ? "Expired - reconnect in Settings" : "Active (within 90 days)"}
                        </div>
                        <div>
                            Data range: {selected.dateRange?.min || "—"} to {selected.dateRange?.max || "—"}
                        </div>
                    </div>
                )}
                <Button onClick={handleSync} disabled={!accountId || loading || (selected?.expired ?? false)}>
                    {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Sync now
                </Button>
                {message && (
                    <Alert>
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertTitle>Success</AlertTitle>
                        <AlertDescription>{message}</AlertDescription>
                    </Alert>
                )}
                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>
    );
}
