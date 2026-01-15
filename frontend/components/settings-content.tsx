"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Bell, CreditCard, Database, Settings2, ArrowRight, Info } from "lucide-react"
import Link from "next/link"
import { BankConnect } from "@/components/bank-connect"
import { BankCredentialsManager } from "@/components/bank-credentials-manager"
import { CardCredentialsManager } from "@/components/card-credentials-manager"
import { useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { apiFetch } from "@/lib/api"

export function SettingsContent({ connections = [] }: { connections?: any[] }) {
    const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [localConnections, setLocalConnections] = useState(connections);

    const handleDisconnect = async (id: string, label: string) => {
        setFeedback(null);
        try {
            await apiFetch(`/api/bank/connections/${id}`, { method: "DELETE", skipJson: true });
            setFeedback({ type: "success", message: `${label} disconnected successfully.` });
            setLocalConnections((prev: any[]) => prev.filter((c) => c.id !== id));
        } catch (err: any) {
            setFeedback({ type: "error", message: err.message || "Failed to disconnect" });
        }
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
                        Manage all your reference data including card types, banks, categories, and sub-categories in one place.
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
                </CardContent>
            </Card>

            <BankConnect />
            <BankCredentialsManager />
            <CardCredentialsManager />
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
                        const days = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24));
                        const daysLeft = Math.max(0, 90 - days);
                        return (
                            <div key={c.id} className="flex items-center justify-between border rounded-lg p-3">
                                    <div className="space-y-1">
                                        <div className="font-medium">{c.institutionId || c.provider}</div>
                                        <div className="text-xs text-muted-foreground">User: {c.userId}</div>
                                <div className="text-xs text-muted-foreground">
                                    Reconnect in ~{daysLeft} day{daysLeft === 1 ? "" : "s"}
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
                        <button className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                            Export
                        </button>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Clear All Data</Label>
                            <p className="text-sm text-muted-foreground text-destructive">
                                Permanently delete all cards and transactions
                            </p>
                        </div>
                        <button className="px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90">
                            Clear
                        </button>
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
