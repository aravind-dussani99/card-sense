"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Calendar, CreditCard, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { StatementData } from "@/lib/statement-service";

interface StatementViewerProps {
    statementData: StatementData;
    cardName?: string;
}

export function StatementViewer({ statementData, cardName }: StatementViewerProps) {
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

    const totalDebits = statementData.transactions
        .filter(tx => tx.type === "debit")
        .reduce((sum, tx) => sum + tx.amount, 0);
    
    const totalCredits = statementData.transactions
        .filter(tx => tx.type === "credit")
        .reduce((sum, tx) => sum + tx.amount, 0);

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Bank Statement
                    </CardTitle>
                    <CardDescription>
                        Extracted statement data from email
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Statement Info */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Card</p>
                            <p className="font-medium">
                                {cardName || statementData.cardLast4 ? `••${statementData.cardLast4}` : "Unknown"}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Bank</p>
                            <p className="font-medium">{statementData.bankName || "Unknown"}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Period Start</p>
                            <p className="font-medium">{formatDate(statementData.statementPeriod.start)}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Period End</p>
                            <p className="font-medium">{formatDate(statementData.statementPeriod.end)}</p>
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Total Transactions</p>
                            <p className="text-2xl font-bold">{statementData.transactions.length}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <TrendingDown className="h-3 w-3 text-red-600" />
                                Total Debits
                            </p>
                            <p className="text-2xl font-bold text-red-600">{formatCurrency(totalDebits)}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <TrendingUp className="h-3 w-3 text-green-600" />
                                Total Credits
                            </p>
                            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalCredits)}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Transactions Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Transactions</CardTitle>
                    <CardDescription>
                        {statementData.transactions.length} transactions found in statement
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    {statementData.transactions.some(tx => tx.balance) && (
                                        <TableHead className="text-right">Balance</TableHead>
                                    )}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {statementData.transactions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                            No transactions found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    statementData.transactions.map((tx, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell>{formatDate(tx.date)}</TableCell>
                                            <TableCell className="max-w-md truncate">{tx.description}</TableCell>
                                            <TableCell>
                                                <Badge variant={tx.type === "debit" ? "destructive" : "default"}>
                                                    {tx.type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className={`text-right font-medium ${
                                                tx.type === "debit" ? "text-red-600" : "text-green-600"
                                            }`}>
                                                {tx.type === "debit" ? "-" : "+"}{formatCurrency(tx.amount)}
                                            </TableCell>
                                            {statementData.transactions.some(t => t.balance) && (
                                                <TableCell className="text-right text-muted-foreground">
                                                    {tx.balance ? formatCurrency(tx.balance) : "-"}
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Offers */}
            {statementData.offers && statementData.offers.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Offers</CardTitle>
                        <CardDescription>
                            Offers found in statement
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {statementData.offers.map((offer, idx) => (
                                <div key={idx} className="p-3 border rounded-lg">
                                    <p className="font-medium">{offer.title}</p>
                                    <p className="text-sm text-muted-foreground mt-1">{offer.description}</p>
                                    {offer.validUntil && (
                                        <p className="text-xs text-muted-foreground mt-2">
                                            Valid until: {formatDate(offer.validUntil)}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

