"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, AlertCircle } from "lucide-react";

interface StatementPasswordDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    emailSubject: string;
    cardName?: string;
    onPasswordSubmit: (password: string) => Promise<void>;
    onSkip: () => void;
}

export function StatementPasswordDialog({
    open,
    onOpenChange,
    emailSubject,
    cardName,
    onPasswordSubmit,
    onSkip,
}: StatementPasswordDialogProps) {
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!password.trim()) {
            setError("Please enter a password");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await onPasswordSubmit(password);
            setPassword("");
            onOpenChange(false);
        } catch (err: any) {
            setError(err.message || "Failed to process statement with provided password");
        } finally {
            setLoading(false);
        }
    };

    const handleSkip = () => {
        setPassword("");
        setError(null);
        onSkip();
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Lock className="h-5 w-5" />
                        Password Required
                    </DialogTitle>
                    <DialogDescription>
                        This bank statement PDF is password protected. Please enter the password to extract transactions.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm font-medium text-blue-900 mb-1">Statement Details</p>
                        <p className="text-xs text-blue-700">{emailSubject}</p>
                        {cardName && (
                            <p className="text-xs text-blue-700 mt-1">Card: {cardName}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Statement Password</Label>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                setError(null);
                            }}
                            placeholder="Enter PDF password"
                            disabled={loading}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !loading) {
                                    handleSubmit();
                                }
                            }}
                        />
                        <p className="text-xs text-muted-foreground">
                            This password is typically provided by your bank for encrypted statements.
                        </p>
                    </div>

                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleSkip} disabled={loading}>
                        Skip
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading || !password.trim()}>
                        {loading ? "Processing..." : "Submit"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

