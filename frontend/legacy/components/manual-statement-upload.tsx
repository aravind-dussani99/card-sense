"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, Loader2, AlertCircle, CheckCircle2, Lock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { processManualStatement } from "@/app/actions/statement-actions";
import { StatementViewer } from "@/components/statement-viewer";
import { ReconciliationReport } from "@/components/reconciliation-report";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ManualStatementUploadProps {
    cards: any[];
}

export function ManualStatementUpload({ cards }: ManualStatementUploadProps) {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [showPasswordDialog, setShowPasswordDialog] = useState(false);
    const [passwordInput, setPasswordInput] = useState("");
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    
    const [formData, setFormData] = useState({
        cardId: "",
        statementText: "",
        statementPeriodStart: "",
        statementPeriodEnd: "",
        password: "",
    });

    const [file, setFile] = useState<File | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async () => {
        if (!formData.statementText && !file) {
            setError("Please provide statement text or upload a file");
            return;
        }

        const uploadWithPassword = async (fileToSend: File, passwordOverride?: string) => {
            const formDataToSend = new FormData();
            formDataToSend.append('file', fileToSend);
            if (formData.cardId) formDataToSend.append('cardId', formData.cardId);
            if (formData.statementPeriodStart) formDataToSend.append('statementPeriodStart', formData.statementPeriodStart);
            if (formData.statementPeriodEnd) formDataToSend.append('statementPeriodEnd', formData.statementPeriodEnd);
            const passwordToUse = passwordOverride ?? formData.password;
            if (passwordToUse) formDataToSend.append('password', passwordToUse);

            const response = await fetch('/api/statements/upload', {
                method: 'POST',
                body: formDataToSend,
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                const errorMsg = data.error || "Failed to process statement";
                const lower = errorMsg.toLowerCase();
                if (lower.includes('password') || lower.includes('encrypted')) {
                    setPendingFile(fileToSend);
                    setShowPasswordDialog(true);
                    setError(null);
                    return null;
                } else if (lower.includes('worker') || lower.includes('parsing failed')) {
                    throw new Error(`Parsing failed. This may be due to file format issues. Try: 1) Converting the file to text manually, 2) Using a different file, or 3) Contacting support. Error: ${errorMsg}`);
                } else {
                    throw new Error(`Failed to process statement: ${errorMsg}`);
                }
            }

            return data;
        };

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            let statementText = formData.statementText;
            
            if (file) {
                const uploadResult = await uploadWithPassword(file);
                if (uploadResult) {
                    setResult(uploadResult);
                }
                setLoading(false);
                return;
            }

            // If we have text (from textarea), process it
            if (statementText) {
                const result = await processManualStatement({
                    cardId: formData.cardId || undefined,
                    statementText,
                    statementPeriodStart: formData.statementPeriodStart ? new Date(formData.statementPeriodStart) : undefined,
                    statementPeriodEnd: formData.statementPeriodEnd ? new Date(formData.statementPeriodEnd) : undefined,
                });

                if (!result.success) {
                    throw new Error(result.error || "Failed to process statement");
                }

                setResult(result);
                return;
            }
        } catch (err: any) {
            setError(err.message || "Failed to process statement");
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordSubmit = async () => {
        if (!pendingFile) {
            setShowPasswordDialog(false);
            return;
        }
        setLoading(true);
        try {
            const formDataToSend = new FormData();
            formDataToSend.append('file', pendingFile);
            if (formData.cardId) formDataToSend.append('cardId', formData.cardId);
            if (formData.statementPeriodStart) formDataToSend.append('statementPeriodStart', formData.statementPeriodStart);
            if (formData.statementPeriodEnd) formDataToSend.append('statementPeriodEnd', formData.statementPeriodEnd);
            if (passwordInput) formDataToSend.append('password', passwordInput);

            const response = await fetch('/api/statements/upload', {
                method: 'POST',
                body: formDataToSend,
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                const errorMsg = data.error || "Failed to process statement";
                throw new Error(errorMsg);
            }
            setResult(data);
            setShowPasswordDialog(false);
            setPendingFile(null);
            setPasswordInput("");
        } catch (err: any) {
            setError(err.message || "Failed to process statement");
            setShowPasswordDialog(false);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5" />
                        Upload Statement
                    </CardTitle>
                    <CardDescription>
                        Upload a PDF, image, or paste statement text to extract transactions
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="cardId">Card (optional)</Label>
                        <Select value={formData.cardId} onValueChange={(value) => setFormData({ ...formData, cardId: value })}>
                            <SelectTrigger id="cardId">
                                <SelectValue placeholder="Select a card (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                                {cards.map((card) => (
                                    <SelectItem key={card.id} value={card.id}>
                                        {card.name} (••{card.last4})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="statementPeriodStart">Statement Period Start (optional)</Label>
                            <Input
                                id="statementPeriodStart"
                                type="date"
                                value={formData.statementPeriodStart}
                                onChange={(e) => setFormData({ ...formData, statementPeriodStart: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="statementPeriodEnd">Statement Period End (optional)</Label>
                            <Input
                                id="statementPeriodEnd"
                                type="date"
                                value={formData.statementPeriodEnd}
                                onChange={(e) => setFormData({ ...formData, statementPeriodEnd: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="file">Upload File (PDF, Excel, CSV, or Image)</Label>
                        <Input
                            id="file"
                            type="file"
                            accept=".pdf,.xlsx,.xls,.csv,image/*"
                            onChange={handleFileChange}
                            disabled={loading}
                        />
                        <p className="text-xs text-muted-foreground">
                            Supported formats: PDF, Excel (.xlsx/.xls), CSV, PNG, JPG, JPEG
                        </p>
                    </div>

                    {file && (
                        <div className="space-y-2">
                            <Label htmlFor="password">File Password (if encrypted PDF)</Label>
                            <Input
                                id="password"
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                placeholder="Enter file password (optional for encrypted PDFs)"
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="statementText">Or Paste Statement Text</Label>
                        <Textarea
                            id="statementText"
                            value={formData.statementText}
                            onChange={(e) => setFormData({ ...formData, statementText: e.target.value })}
                            placeholder="Paste statement text here..."
                            rows={10}
                            disabled={loading}
                        />
                    </div>

                    <Button
                        onClick={handleSubmit}
                        disabled={loading || (!formData.statementText && !file)}
                        className="w-full"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <FileText className="mr-2 h-4 w-4" />
                                Process Statement
                            </>
                        )}
                    </Button>

                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {result && result.statementData && (
                <div className="space-y-4">
                    <StatementViewer
                        statementData={result.statementData}
                        cardName={cards.find(c => c.id === formData.cardId)?.name}
                    />
                    {result.reconciliation && (
                        <ReconciliationReport
                            matched={result.reconciliation.matched}
                            unmatched={result.reconciliation.unmatched}
                            missing={result.reconciliation.missing}
                            statementPeriod={result.statementData.statementPeriod}
                        />
                    )}
                </div>
            )}

            <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
                <DialogContent className="max-w-sm">
                    <DialogHeader className="items-center text-center space-y-2">
                        <div className="mx-auto h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                            <Lock className="h-6 w-6 text-blue-600" />
                        </div>
                        <DialogTitle className="text-lg font-semibold">Unlock statement</DialogTitle>
                        <p className="text-sm text-muted-foreground">
                            Please enter the password to unlock this document.
                        </p>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="passwordPrompt">Password</Label>
                        <Input
                            id="passwordPrompt"
                            type="password"
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <DialogFooter className="gap-2 sm:gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setShowPasswordDialog(false);
                                setPendingFile(null);
                                setPasswordInput("");
                            }}
                        >
                            Cancel
                        </Button>
                        <Button type="button" onClick={handlePasswordSubmit} disabled={loading || !passwordInput}>
                            OK
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
