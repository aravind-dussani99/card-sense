"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Bell, CreditCard, Database, Settings2, ArrowRight, Info } from "lucide-react"
import Link from "next/link"
import { BankConnect } from "@/components/bank-connect"
import { useSyncExternalStore, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { apiFetch } from "@/lib/api"
import { getErrorMessage } from "@/lib/errors"
import { BankConnection } from "@/lib/types"
import { clearPassphraseMarker, passphraseMarkerExists, setPassphraseMarker } from "@/lib/vault"
import { getStoredVisibility, setStoredDuration } from "@/lib/balance-visibility"

export function SettingsContent({ connections = [] }: { connections?: BankConnection[] }) {
    const subscribePassphrase = (callback: () => void) => {
        if (typeof window === "undefined") return () => {};
        window.addEventListener("cardsense-passphrase", callback);
        return () => window.removeEventListener("cardsense-passphrase", callback);
    };
    const passphraseSet = useSyncExternalStore(
        subscribePassphrase,
        () => (typeof window !== "undefined" ? passphraseMarkerExists() : false),
        () => false
    );
    const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [localConnections, setLocalConnections] = useState<BankConnection[]>(connections);
    const [passphrase, setPassphrase] = useState("");
    const [passphraseConfirm, setPassphraseConfirm] = useState("");
    const [passphraseStatus, setPassphraseStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const initialVisibility = getStoredVisibility();
    const initialDurationMode = ["10", "30", "60", "120"].includes(String(initialVisibility.duration))
        ? String(initialVisibility.duration)
        : "custom";
    const [balanceDuration, setBalanceDuration] = useState(initialVisibility.duration);
    const [durationMode, setDurationMode] = useState(initialDurationMode);
    const [customDuration, setCustomDuration] = useState(
        initialDurationMode === "custom" ? String(initialVisibility.duration) : ""
    );
    const passphraseLoaded = true;

    const handleDisconnect = async (id: string, label: string) => {
        setFeedback(null);
        try {
            await apiFetch(`/api/bank/connections/${id}`, { method: "DELETE", skipJson: true });
            setFeedback({ type: "success", message: `${label} disconnected successfully.` });
            setLocalConnections((prev) => prev.filter((c) => c.id !== id));
        } catch (err) {
            setFeedback({ type: "error", message: getErrorMessage(err, "Failed to disconnect") });
        }
    };

    const handlePassphraseSave = async () => {
        setPassphraseStatus(null);
        if (!passphrase) {
            setPassphraseStatus({ type: "error", message: "Enter a passphrase." });
            return;
        }
        if (passphrase !== passphraseConfirm) {
            setPassphraseStatus({ type: "error", message: "Passphrases do not match." });
            return;
        }
        try {
            await setPassphraseMarker(passphrase);
            setPassphrase("");
            setPassphraseConfirm("");
            setPassphraseStatus({ type: "success", message: "Passphrase saved on this device." });
        } catch (error) {
            setPassphraseStatus({ type: "error", message: getErrorMessage(error, "Failed to save passphrase.") });
        }
    };


    const handlePassphraseClear = () => {
        clearPassphraseMarker();
        setPassphrase("");
        setPassphraseConfirm("");
        setPassphraseStatus({ type: "success", message: "Passphrase cleared on this device." });
    };


    return (
        <div className="grid gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Settings2 className="h-5 w-5" />
                        Reference Data Management
                    </CardTitle>
                    <CardDescription>
                        Manage head accounts, categories, and sub-categories in one place.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Link href="/reference-data" prefetch={false}>
                        <Button className="w-full sm:w-auto">
                            Manage Head of Accounts
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </Link>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        Secure Vault (Local-Only)
                    </CardTitle>
                    <CardDescription>
                        Store sensitive details encrypted on this device only. Nothing is sent to the server.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Link href="/vault" prefetch={false}>
                        <Button className="w-full sm:w-auto" variant="outline">
                            Open Vault
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </Link>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        Security Passphrase
                    </CardTitle>
                    <CardDescription>
                        Set or update the passphrase used to unlock sensitive card and account details.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {passphraseStatus && (
                        <Alert variant={passphraseStatus.type === "success" ? "default" : "destructive"}>
                            <AlertTitle>{passphraseStatus.type === "success" ? "Success" : "Error"}</AlertTitle>
                            <AlertDescription>{passphraseStatus.message}</AlertDescription>
                        </Alert>
                    )}
                    <div className="text-sm text-muted-foreground">
                        {passphraseLoaded ? (
                            passphraseSet ? "Passphrase is set for this device." : "No passphrase set for this device."
                        ) : (
                            "Checking passphrase status..."
                        )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="passphrase">Passphrase</Label>
                            <Input
                                id="passphrase"
                                type="password"
                                value={passphrase}
                                onChange={(e) => setPassphrase(e.target.value)}
                                placeholder="Enter passphrase"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="passphraseConfirm">Confirm Passphrase</Label>
                            <Input
                                id="passphraseConfirm"
                                type="password"
                                value={passphraseConfirm}
                                onChange={(e) => setPassphraseConfirm(e.target.value)}
                                placeholder="Confirm passphrase"
                            />
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" onClick={handlePassphraseSave}>
                            {passphraseSet ? "Update Passphrase" : "Set Passphrase"}
                        </Button>
                        {passphraseSet && (
                            <Button type="button" variant="outline" onClick={handlePassphraseClear}>
                                Clear Passphrase
                            </Button>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        This passphrase is stored locally and is required to decrypt sensitive fields.
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5" />
                        Notifications
                    </CardTitle>
                    <CardDescription>
                        Manage how you receive notifications about your credit cards.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Payment Reminders</Label>
                            <p className="text-sm text-muted-foreground">
                                Get notified before payment due dates
                            </p>
                        </div>
                        <Input type="checkbox" className="w-4 h-4" defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>High Utilization Alerts</Label>
                            <p className="text-sm text-muted-foreground">
                                Alert when credit utilization exceeds 80%
                            </p>
                        </div>
                        <Input type="checkbox" className="w-4 h-4" defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Transaction Alerts</Label>
                            <p className="text-sm text-muted-foreground">
                                Notify when large transactions are recorded
                            </p>
                        </div>
                        <Input type="checkbox" className="w-4 h-4" />
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Display Preferences
                    </CardTitle>
                    <CardDescription>
                        Customize how information is displayed in the app.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="currency">Currency Symbol</Label>
                        <Input
                            id="currency"
                            defaultValue="$"
                            placeholder="$"
                            className="max-w-[100px]"
                        />
                        <p className="text-sm text-muted-foreground">
                            Default currency symbol for displaying amounts
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="dateFormat">Date Format</Label>
                        <Input
                            id="dateFormat"
                            defaultValue="MM/DD/YYYY"
                            placeholder="MM/DD/YYYY"
                            className="max-w-[200px]"
                        />
                        <p className="text-sm text-muted-foreground">
                            Preferred date format for transactions
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="balanceVisibility">Balance visibility duration</Label>
                        <select
                            id="balanceVisibility"
                            className="border rounded-md px-3 py-2 text-sm w-full max-w-[240px]"
                            value={durationMode}
                            onChange={(e) => {
                                const value = e.target.value;
                                setDurationMode(value);
                                if (value !== "custom") {
                                    const seconds = Number(value);
                                    setBalanceDuration(seconds);
                                    setStoredDuration(seconds);
                                }
                            }}
                        >
                            <option value="10">10 seconds</option>
                            <option value="30">30 seconds</option>
                            <option value="60">60 seconds</option>
                            <option value="120">120 seconds</option>
                            <option value="custom">Custom</option>
                        </select>
                        {durationMode === "custom" && (
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    min="1"
                                    placeholder="Seconds"
                                    value={customDuration}
                                    onChange={(e) => setCustomDuration(e.target.value)}
                                    className="max-w-[140px]"
                                />
                                <Button
                                    variant="outline"
                                    type="button"
                                    onClick={() => {
                                        const seconds = Number(customDuration);
                                        if (Number.isFinite(seconds) && seconds > 0) {
                                            setBalanceDuration(seconds);
                                            setStoredDuration(seconds);
                                        }
                                    }}
                                >
                                    Save
                                </Button>
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                            Balances auto-hide after {balanceDuration}s when revealed.
                        </p>
                    </div>
                </CardContent>
            </Card>

            <BankConnect />
            {connections.length > 0 && (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        Connected Bank Links
                    </CardTitle>
                    <CardDescription>Consent expires every 90 days. Reconnect as needed.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {feedback && (
                        <Alert variant={feedback.type === "success" ? "default" : "destructive"}>
                            <AlertTitle>{feedback.type === "success" ? "Success" : "Error"}</AlertTitle>
                            <AlertDescription>{feedback.message}</AlertDescription>
                        </Alert>
                    )}
                    {localConnections.map((c) => {
                        const daysLeft = c.daysLeft ?? null;
                        return (
                            <div key={c.id} className="flex items-center justify-between border rounded-lg p-3">
                                    <div className="space-y-1">
                                        <div className="font-medium">{c.institutionId || c.provider}</div>
                                        <div className="text-xs text-muted-foreground">User: {c.userId}</div>
                                <div className="text-xs text-muted-foreground">
                                    {daysLeft === null
                                        ? "Reconnect in ~— days"
                                        : `Reconnect in ~${daysLeft} day${daysLeft === 1 ? "" : "s"}`}
                                </div>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => handleDisconnect(c.id, c.institutionId || c.provider || "Connection")}
                            >
                                Disconnect
                            </Button>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        Data Management
                    </CardTitle>
                    <CardDescription>
                        Manage your data and export options.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Export Data</Label>
                            <p className="text-sm text-muted-foreground">
                                Download your cards and transactions as CSV
                            </p>
                        </div>
                        <Button>
                            Export
                        </Button>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Clear All Data</Label>
                            <p className="text-sm text-muted-foreground text-destructive">
                                Permanently delete all cards and transactions
                            </p>
                        </div>
                        <Button variant="destructive">
                            Clear
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Info className="h-5 w-5" />
                        About
                    </CardTitle>
                    <CardDescription>
                        Information about CardSense.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Version</span>
                        <span className="text-sm">1.0.0</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">License</span>
                        <span className="text-sm">MIT</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
