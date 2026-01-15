"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Loader2, CheckCircle2, XCircle, AlertCircle, RefreshCw } from "lucide-react";
import { testEmailConnection } from "@/app/actions/test-email-connection";

interface ProviderStatus {
    configured: boolean;
    connected: boolean;
    emailCount: number;
    error: string | null;
    testing: boolean;
    processing: boolean;
}

export function EmailProviderManager() {
    const [gmailStatus, setGmailStatus] = useState<ProviderStatus>({
        configured: false,
        connected: false,
        emailCount: 0,
        error: null,
        testing: false,
        processing: false,
    });
    const [outlookStatus, setOutlookStatus] = useState<ProviderStatus>({
        configured: false,
        connected: false,
        emailCount: 0,
        error: null,
        testing: false,
        processing: false,
    });
    const handleTestConnection = async (provider: "gmail" | "outlook") => {
        const setStatus = provider === "gmail" ? setGmailStatus : setOutlookStatus;
        setStatus(prev => ({ ...prev, testing: true, error: null }));

        try {
            const response = await testEmailConnection(provider);
            if (response.success && response.result) {
                setStatus({
                    configured: response.result.configured,
                    connected: response.result.connected,
                    emailCount: response.result.emailCount,
                    error: response.result.error,
                    testing: false,
                    processing: false,
                });
            } else {
                setStatus({
                    configured: response.result?.configured || false,
                    connected: false,
                    emailCount: 0,
                    error: response.error || response.result?.error || "Connection failed",
                    testing: false,
                    processing: false,
                });
            }
        } catch (error: any) {
            setStatus(prev => ({
                ...prev,
                connected: false,
                error: error.message || "Connection test failed",
                testing: false,
            }));
        }
    };

    return (
        <>
            <div className="grid gap-4 md:grid-cols-2">
                {/* Gmail Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Mail className="h-5 w-5" />
                            Gmail
                        </CardTitle>
                        <CardDescription>
                            Connect and process emails from your Gmail account
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Status:</span>
                            {gmailStatus.configured ? (
                                gmailStatus.connected ? (
                                    <div className="flex items-center gap-2 text-green-600">
                                        <CheckCircle2 className="h-4 w-4" />
                                        <span>Connected</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-red-600">
                                        <XCircle className="h-4 w-4" />
                                        <span>Failed</span>
                                    </div>
                                )
                            ) : (
                                <span className="text-sm text-muted-foreground">Not configured</span>
                            )}
                        </div>

                        {gmailStatus.configured && gmailStatus.connected && (
                            <div className="text-sm text-muted-foreground">
                                Unread emails: <span className="font-medium">{gmailStatus.emailCount}</span>
                            </div>
                        )}

                        {gmailStatus.error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs whitespace-pre-line">
                                {gmailStatus.error}
                            </div>
                        )}

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestConnection("gmail")}
                            disabled={gmailStatus.testing}
                            className="w-full"
                        >
                            {gmailStatus.testing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Testing...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Test Connection
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>

                {/* Outlook Section */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Mail className="h-5 w-5" />
                            Outlook
                        </CardTitle>
                        <CardDescription>
                            Connect and process emails from your Outlook account
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Status:</span>
                            {outlookStatus.configured ? (
                                outlookStatus.connected ? (
                                    <div className="flex items-center gap-2 text-green-600">
                                        <CheckCircle2 className="h-4 w-4" />
                                        <span>Connected</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-red-600">
                                        <XCircle className="h-4 w-4" />
                                        <span>Failed</span>
                                    </div>
                                )
                            ) : (
                                <span className="text-sm text-muted-foreground">Not configured</span>
                            )}
                        </div>

                        {outlookStatus.configured && outlookStatus.connected && (
                            <div className="text-sm text-muted-foreground">
                                Unread emails: <span className="font-medium">{outlookStatus.emailCount}</span>
                            </div>
                        )}

                        {outlookStatus.error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs whitespace-pre-line">
                                {outlookStatus.error}
                            </div>
                        )}

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestConnection("outlook")}
                            disabled={outlookStatus.testing}
                            className="w-full"
                        >
                            {outlookStatus.testing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Testing...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Test Connection
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

