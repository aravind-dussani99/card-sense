"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, RefreshCw, Link2, AlertCircle } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

export function BankConnect() {
    const [userId, setUserId] = useState("user-001");
    const [syncing, setSyncing] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const authUrl = useMemo(() => {
        const clientId = process.env.NEXT_PUBLIC_TRUELAYER_CLIENT_ID || "";
        const redirect = process.env.NEXT_PUBLIC_TRUELAYER_REDIRECT_URI || `${getApiBaseUrl()}/api/bank/callback`;
        if (!clientId) return "";
        const scope = encodeURIComponent("info accounts balance cards transactions direct_debits standing_orders offline_access");
        const providers = encodeURIComponent("uk-cs-mock uk-ob-all uk-oauth-all");
        return `${process.env.NEXT_PUBLIC_TRUELAYER_AUTH_BASE || "https://auth.truelayer.com"}/?response_type=code&client_id=${clientId}&scope=${scope}&redirect_uri=${encodeURIComponent(redirect)}&providers=${providers}&state=${encodeURIComponent(userId)}`;
    }, [userId]);

    const handleSync = async () => {
        try {
            setSyncing(true);
            setError(null);
            setMessage(null);
            const res = await fetch(`${getApiBaseUrl()}/api/bank/sync`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || "Sync failed");
            }
            setMessage(`Synced ${data.synced || 0} connection(s)`);
        } catch (err: any) {
            setError(err.message || "Sync failed");
        } finally {
            setSyncing(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Link2 className="h-5 w-5" />
                    Open Banking (TrueLayer)
                </CardTitle>
                <CardDescription>
                    Connect a bank via TrueLayer Auth Dialog and pull transactions. Client ID is read from NEXT_PUBLIC_TRUELAYER_CLIENT_ID.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="userId">User ID (state)</Label>
                    <Input
                        id="userId"
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                        placeholder="user-id"
                    />
                    <p className="text-xs text-muted-foreground">Used in state to associate the connection.</p>
                </div>
        <div className="flex flex-wrap gap-3">
                    <Button
                        disabled={!authUrl}
                        onClick={() => {
                            if (authUrl) window.open(authUrl, "_blank", "noopener,noreferrer");
                        }}
                    >
                        Launch Auth Dialog
                    </Button>
                    <Button variant="outline" onClick={handleSync} disabled={syncing}>
                        {syncing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Sync now
                    </Button>
                </div>
                {!authUrl && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Missing client ID</AlertTitle>
                        <AlertDescription>Set NEXT_PUBLIC_TRUELAYER_CLIENT_ID in .env for the Auth Dialog link.</AlertDescription>
                    </Alert>
                )}
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
