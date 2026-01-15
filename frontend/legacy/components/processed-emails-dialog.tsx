"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, CheckCircle2, XCircle, AlertCircle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { getProcessedEmails } from "@/app/actions/email-processor-actions";
import { formatDate } from "@/lib/utils";

export function ProcessedEmailsDialog() {
    const [open, setOpen] = useState(false);
    const [emails, setEmails] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    const loadEmails = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await getProcessedEmails(100);
            setEmails(result);
        } catch (err: any) {
            setError(err.message || "Failed to load processed emails");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            loadEmails();
        }
    }, [open]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "processed":
                return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Processed</Badge>;
            case "failed":
                return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
            case "partial":
                return <Badge className="bg-yellow-100 text-yellow-800"><AlertCircle className="h-3 w-3 mr-1" />Partial</Badge>;
            default:
                return <Badge>{status}</Badge>;
        }
    };

    const toggleRow = (emailId: string) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(emailId)) {
            newExpanded.delete(emailId);
        } else {
            newExpanded.add(emailId);
        }
        setExpandedRows(newExpanded);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Mail className="h-4 w-4 mr-2" />
                    View Processed Emails
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span>Processed Emails</span>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={loadEmails}
                            disabled={loading}
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </DialogTitle>
                    <DialogDescription>
                        View all processed emails for debugging and testing. Shows transaction and offer extraction results.
                    </DialogDescription>
                </DialogHeader>
                
                {loading && emails.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : error ? (
                    <Card className="border-red-200 bg-red-50">
                        <CardContent className="p-4">
                            <p className="text-red-800">{error}</p>
                        </CardContent>
                    </Card>
                ) : emails.length === 0 ? (
                    <Card>
                        <CardContent className="p-8 text-center">
                            <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold mb-2">No Processed Emails</h3>
                            <p className="text-muted-foreground">
                                No emails have been processed yet. Process emails from the Draft Transactions or Offers page.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        <div className="text-sm text-muted-foreground">
                            Showing {emails.length} processed email{emails.length !== 1 ? 's' : ''}
                        </div>
                        <div className="border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-8"></TableHead>
                                        <TableHead>Subject</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-center">Transactions</TableHead>
                                        <TableHead className="text-center">Offers</TableHead>
                                        <TableHead>Original Date</TableHead>
                                        <TableHead>Processed At</TableHead>
                                        <TableHead>Error</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {emails.map((email) => {
                                        const isExpanded = expandedRows.has(email.id);
                                        return (
                                            <>
                                                <TableRow key={email.id} className="cursor-pointer hover:bg-muted/50" onClick={() => toggleRow(email.id)}>
                                                    <TableCell>
                                                        {isExpanded ? (
                                                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                                        ) : (
                                                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="max-w-md">
                                                        <div className="truncate" title={email.emailSubject || email.emailId}>
                                                            {email.emailSubject || email.emailId}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {getStatusBadge(email.status)}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {email.transactionCount > 0 ? (
                                                            <Badge variant="outline" className="bg-blue-50">
                                                                {email.transactionCount}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-muted-foreground">0</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {email.offerCount > 0 ? (
                                                            <Badge variant="outline" className="bg-purple-50">
                                                                {email.offerCount}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-muted-foreground">0</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {email.originalDate ? formatDate(new Date(email.originalDate)) : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {formatDate(email.processedAt)}
                                                    </TableCell>
                                                    <TableCell className="max-w-xs">
                                                        {email.errorMessage ? (
                                                            <div className="text-xs text-red-600 truncate" title={email.errorMessage}>
                                                                {email.errorMessage}
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted-foreground">-</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                                {isExpanded && (
                                                    <TableRow key={`${email.id}-expanded`}>
                                                        <TableCell colSpan={8} className="bg-muted/30 p-4">
                                                            <div className="space-y-2">
                                                                <div className="text-sm font-semibold">Email Content:</div>
                                                                {email.emailBody ? (
                                                                    <div className="text-sm text-muted-foreground whitespace-pre-wrap max-h-96 overflow-y-auto p-3 bg-background rounded border">
                                                                        {email.emailBody}
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-sm text-muted-foreground italic">No email body available</div>
                                                                )}
                                                                {email.errorMessage && (
                                                                    <div className="mt-2">
                                                                        <div className="text-sm font-semibold text-red-600">Error:</div>
                                                                        <div className="text-sm text-red-600">{email.errorMessage}</div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

