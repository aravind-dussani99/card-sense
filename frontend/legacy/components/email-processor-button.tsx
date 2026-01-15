"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { processEmails, getProcessingStats } from "@/app/actions/email-processor-actions";
import { testEmailConnection } from "@/app/actions/test-email-connection";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";

export function EmailProcessorButton() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [testingConnection, setTestingConnection] = useState(false);
    const [connectionTest, setConnectionTest] = useState<any>(null);

    const handleTestConnection = async () => {
        setTestingConnection(true);
        const testResult = await testEmailConnection();
        setTestingConnection(false);
        setConnectionTest(testResult);
    };

    const handleProcessEmails = async () => {
        setLoading(true);
        const response = await processEmails();
        setLoading(false);
        setResult(response);
        setDialogOpen(true);
        
        if (response.success) {
            router.refresh();
        }
    };

    return (
        <>
            <div className="flex gap-2">
                <Button 
                    onClick={handleTestConnection} 
                    disabled={testingConnection}
                    variant="outline"
                >
                    {testingConnection ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Testing...
                        </>
                    ) : (
                        <>
                            <AlertCircle className="mr-2 h-4 w-4" />
                            Test Connection
                        </>
                    )}
                </Button>
                <Button onClick={handleProcessEmails} disabled={loading}>
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                        </>
                    ) : (
                        <>
                            <Mail className="mr-2 h-4 w-4" />
                            Process Emails
                        </>
                    )}
                </Button>
            </div>

            {/* Connection Test Dialog */}
            <Dialog open={connectionTest !== null} onOpenChange={() => setConnectionTest(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Email Connection Test</DialogTitle>
                        <DialogDescription>
                            Test results for Gmail and Outlook email connections
                        </DialogDescription>
                    </DialogHeader>
                    {connectionTest?.success && connectionTest.results && (
                        <div className="space-y-4">
                            {/* Gmail Status */}
                            <div className="border rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-semibold">Gmail</h3>
                                    {connectionTest.results.gmail.configured ? (
                                        connectionTest.results.gmail.connected ? (
                                            <div className="flex items-center text-green-600">
                                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                                Connected
                                            </div>
                                        ) : (
                                            <div className="flex items-center text-red-600">
                                                <XCircle className="h-4 w-4 mr-1" />
                                                Failed
                                            </div>
                                        )
                                    ) : (
                                        <span className="text-muted-foreground text-sm">Not configured</span>
                                    )}
                                </div>
                                {connectionTest.results.gmail.configured && (
                                    <div className="text-sm space-y-1">
                                        <p>Status: {connectionTest.results.gmail.connected ? "✅ Connected" : "❌ Failed"}</p>
                                        <p>Emails found: {connectionTest.results.gmail.emailCount}</p>
                                        {connectionTest.results.gmail.error && (
                                            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs whitespace-pre-line">
                                                {connectionTest.results.gmail.error}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Outlook Status */}
                            <div className="border rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-semibold">Outlook</h3>
                                    {connectionTest.results.outlook.configured ? (
                                        connectionTest.results.outlook.connected ? (
                                            <div className="flex items-center text-green-600">
                                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                                Connected
                                            </div>
                                        ) : (
                                            <div className="flex items-center text-red-600">
                                                <XCircle className="h-4 w-4 mr-1" />
                                                Failed
                                            </div>
                                        )
                                    ) : (
                                        <span className="text-muted-foreground text-sm">Not configured</span>
                                    )}
                                </div>
                                {connectionTest.results.outlook.configured && (
                                    <div className="text-sm space-y-1">
                                        <p>Status: {connectionTest.results.outlook.connected ? "✅ Connected" : "❌ Failed"}</p>
                                        <p>Emails found: {connectionTest.results.outlook.emailCount}</p>
                                        {connectionTest.results.outlook.error && (
                                            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs whitespace-pre-line">
                                                {connectionTest.results.outlook.error}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Summary */}
                            <div className="border-t pt-4">
                                <p className="text-sm font-semibold mb-2">Summary</p>
                                <p className="text-sm">Total emails found: {connectionTest.results.totalEmails}</p>
                                {connectionTest.results.sampleEmails.length > 0 && (
                                    <div className="mt-2">
                                        <p className="text-xs font-semibold mb-1">Sample emails:</p>
                                        <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                                            {connectionTest.results.sampleEmails.map((email, idx) => (
                                                <li key={idx} className="text-muted-foreground">
                                                    • {email.subject} ({email.provider})
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {connectionTest && !connectionTest.success && (
                        <div className="text-red-600">
                            <p>Error: {connectionTest.error}</p>
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={() => setConnectionTest(null)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Processing Result Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {result?.success ? "Emails Processed" : "Processing Failed"}
                        </DialogTitle>
                        <DialogDescription>
                            {result?.success
                                ? `Successfully processed ${result.processed} emails. Found ${result.transactions} transactions and ${result.offers} offers.`
                                : result?.error || "An error occurred while processing emails."}
                        </DialogDescription>
                    </DialogHeader>
                    {result?.success && result.processed === 0 && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <p className="text-sm text-yellow-800">
                                <strong>No emails found.</strong> This could mean:
                            </p>
                            <ul className="text-xs text-yellow-700 mt-2 space-y-1 list-disc list-inside">
                                <li>No unread emails matching the search criteria</li>
                                <li>All emails have already been processed</li>
                                <li>Email connection issue - click "Test Connection" to verify</li>
                                <li>Search criteria too restrictive</li>
                            </ul>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="mt-3"
                                onClick={() => {
                                    setDialogOpen(false);
                                    handleTestConnection();
                                }}
                            >
                                Test Connection
                            </Button>
                        </div>
                    )}
                    {result?.errors && result.errors.length > 0 && (
                        <div className="max-h-40 overflow-y-auto">
                            <p className="text-sm font-semibold mb-2">Errors:</p>
                            <ul className="text-xs text-muted-foreground space-y-1">
                                {result.errors.map((error: string, index: number) => (
                                    <li key={index}>• {error}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={() => setDialogOpen(false)}>Close</Button>
                        {result?.success && result.transactions > 0 && (
                            <Button onClick={() => router.push("/drafts")}>
                                View Drafts
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

