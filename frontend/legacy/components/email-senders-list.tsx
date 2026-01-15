"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, AlertTriangle, CheckCircle2, XCircle, Calendar } from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface EmailSendersListProps {
    initialStats: Array<{
        senderEmail: string;
        totalCount: number;
        last7Days: number;
        last30Days: number;
        daysSinceLastEmail: number;
        lastEmailDate: Date;
    }>;
}

export function EmailSendersList({ initialStats }: EmailSendersListProps) {
    const [stats] = useState(initialStats);

    const formatDate = (date: Date | string) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const getStatusBadge = (count7Days: number, count30Days: number) => {
        // Define acceptable limits
        const maxPerDay = 5;
        const maxPerWeek = 20;
        const maxPerMonth = 50;

        const avgPerDay = count7Days / 7;
        const avgPerDay30 = count30Days / 30;

        if (avgPerDay > maxPerDay || count7Days > maxPerWeek || count30Days > maxPerMonth) {
            return (
                <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Excessive
                </Badge>
            );
        } else if (avgPerDay > maxPerDay * 0.7 || count7Days > maxPerWeek * 0.7) {
            return (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                    High
                </Badge>
            );
        } else {
            return (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Normal
                </Badge>
            );
        }
    };

    if (stats.length === 0) {
        return (
            <Card>
                <CardContent className="p-8 text-center">
                    <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Email Senders</h3>
                    <p className="text-muted-foreground">
                        Sender statistics will appear here after processing offer emails.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Offer Email Statistics by Sender
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Sender Email</TableHead>
                                <TableHead>Total Emails</TableHead>
                                <TableHead>Last 7 Days</TableHead>
                                <TableHead>Last 30 Days</TableHead>
                                <TableHead>Avg/Day (7d)</TableHead>
                                <TableHead>Avg/Day (30d)</TableHead>
                                <TableHead>Last Email</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stats.map((stat) => {
                                const avgPerDay7 = (stat.last7Days / 7).toFixed(1);
                                const avgPerDay30 = (stat.last30Days / 30).toFixed(1);
                                const statusBadge = getStatusBadge(stat.last7Days, stat.last30Days);
                                const isExcessive = stat.last7Days > 20 || stat.last30Days > 50 || parseFloat(avgPerDay7) > 5;

                                return (
                                    <TableRow key={stat.senderEmail}>
                                        <TableCell className="font-medium">
                                            {stat.senderEmail}
                                        </TableCell>
                                        <TableCell>{stat.totalCount}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">
                                                {stat.last7Days}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">
                                                {stat.last30Days}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{avgPerDay7}</TableCell>
                                        <TableCell>{avgPerDay30}</TableCell>
                                        <TableCell className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3 text-muted-foreground" />
                                            {formatDate(stat.lastEmailDate)}
                                        </TableCell>
                                        <TableCell>{statusBadge}</TableCell>
                                        <TableCell>
                                            {isExcessive ? (
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() => {
                                                        // TODO: Implement unsubscribe functionality
                                                        alert(`Unsubscribe from ${stat.senderEmail}?\n\nThis will filter out future emails from this sender.`);
                                                    }}
                                                >
                                                    <XCircle className="h-4 w-4 mr-1" />
                                                    Unsubscribe
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled
                                                >
                                                    <CheckCircle2 className="h-4 w-4 mr-1" />
                                                    OK
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>

                <div className="mt-4 p-4 bg-blue-50 rounded-md">
                    <h4 className="font-semibold text-sm mb-2">Acceptable Limits:</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                        <li>• Maximum 5 emails per day (average)</li>
                        <li>• Maximum 20 emails per week</li>
                        <li>• Maximum 50 emails per month</li>
                        <li className="mt-2 text-blue-700">
                            Senders exceeding these limits are marked as "Excessive" and can be unsubscribed.
                        </li>
                    </ul>
                </div>
            </CardContent>
        </Card>
    );
}

