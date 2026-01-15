"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, AlertTriangle, FileText } from "lucide-react";

interface ReconciliationReportProps {
    matched: Array<{ statement: any; existing: string }>;
    unmatched: any[];
    missing: Array<{ id: string; date: Date; amount: number; merchant: string }>;
    statementPeriod: { start: Date; end: Date };
}

export function ReconciliationReport({
    matched,
    unmatched,
    missing,
    statementPeriod,
}: ReconciliationReportProps) {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(amount);
    };

    const formatDate = (date: Date | string) => {
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const totalMatched = matched.length;
    const totalUnmatched = unmatched.length;
    const totalMissing = missing.length;
    const matchRate = totalMatched > 0 ? (totalMatched / (totalMatched + totalUnmatched) * 100).toFixed(1) : "0";

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Reconciliation Report
                    </CardTitle>
                    <CardDescription>
                        Statement period: {formatDate(statementPeriod.start)} to {formatDate(statementPeriod.end)}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Matched</p>
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                                <p className="text-2xl font-bold text-green-600">{totalMatched}</p>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Unmatched</p>
                            <div className="flex items-center gap-2">
                                <XCircle className="h-5 w-5 text-orange-600" />
                                <p className="text-2xl font-bold text-orange-600">{totalUnmatched}</p>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Missing</p>
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-red-600" />
                                <p className="text-2xl font-bold text-red-600">{totalMissing}</p>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Match Rate</p>
                            <p className="text-2xl font-bold">{matchRate}%</p>
                        </div>
                    </div>

                    {/* Unmatched Transactions (from statement, not in DB) */}
                    {totalUnmatched > 0 && (
                        <div className="space-y-2 mb-6">
                            <h3 className="font-semibold flex items-center gap-2">
                                <XCircle className="h-4 w-4 text-orange-600" />
                                Unmatched Transactions ({totalUnmatched})
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                These transactions are in the statement but not in your database. They will be created as draft transactions.
                            </p>
                            <div className="rounded-md border max-h-64 overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {unmatched.slice(0, 20).map((tx, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell>{formatDate(tx.date)}</TableCell>
                                                <TableCell className="max-w-md truncate">{tx.description}</TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {formatCurrency(tx.amount)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            {totalUnmatched > 20 && (
                                <p className="text-xs text-muted-foreground">
                                    Showing first 20 of {totalUnmatched} unmatched transactions
                                </p>
                            )}
                        </div>
                    )}

                    {/* Missing Transactions (in DB, not in statement) */}
                    {totalMissing > 0 && (
                        <div className="space-y-2">
                            <h3 className="font-semibold flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-red-600" />
                                Missing Transactions ({totalMissing})
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                These transactions are in your database but not in the statement. Please review them.
                            </p>
                            <div className="rounded-md border max-h-64 overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Merchant</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {missing.slice(0, 20).map((tx) => (
                                            <TableRow key={tx.id}>
                                                <TableCell>{formatDate(tx.date)}</TableCell>
                                                <TableCell className="max-w-md truncate">{tx.merchant}</TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {formatCurrency(tx.amount)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            {totalMissing > 20 && (
                                <p className="text-xs text-muted-foreground">
                                    Showing first 20 of {totalMissing} missing transactions
                                </p>
                            )}
                        </div>
                    )}

                    {/* All Matched */}
                    {totalMatched > 0 && totalUnmatched === 0 && totalMissing === 0 && (
                        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                            <div className="flex items-center gap-2 text-green-800">
                                <CheckCircle2 className="h-5 w-5" />
                                <p className="font-medium">Perfect Match!</p>
                            </div>
                            <p className="text-sm text-green-700 mt-1">
                                All {totalMatched} transactions in the statement match your database records.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

