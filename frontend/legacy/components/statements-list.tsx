"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Upload, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { ManualStatementUpload } from "@/components/manual-statement-upload";
import { formatDate } from "@/lib/utils";

interface StatementsListProps {
    initialStatements: any[];
    cards: any[];
}

export function StatementsList({ initialStatements, cards }: StatementsListProps) {
    const [statements, setStatements] = useState(initialStatements);
    const [loading, setLoading] = useState(false);

    return (
        <Tabs defaultValue="processed" className="space-y-4">
            <TabsList>
                <TabsTrigger value="processed">Processed Statements</TabsTrigger>
                <TabsTrigger value="upload">Upload Statement</TabsTrigger>
            </TabsList>

            <TabsContent value="processed" className="space-y-4">
                {statements.length === 0 ? (
                    <Card>
                        <CardContent className="p-8 text-center">
                            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold mb-2">No Processed Statements</h3>
                            <p className="text-muted-foreground">
                                Statements will appear here after they are processed from emails or uploaded manually.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {statements.map((statement) => (
                            <Card key={statement.id}>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="text-lg">{statement.emailSubject}</CardTitle>
                                            <CardDescription>
                                                Processed on {formatDate(statement.processedAt)}
                                            </CardDescription>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {statement.status === "processed" ? (
                                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                                            ) : (
                                                <AlertCircle className="h-5 w-5 text-red-600" />
                                            )}
                                            <span className={`text-sm font-medium ${
                                                statement.status === "processed" ? "text-green-600" : "text-red-600"
                                            }`}>
                                                {statement.status}
                                            </span>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Transactions</p>
                                            <p className="text-lg font-semibold">{statement.transactionCount}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Offers</p>
                                            <p className="text-lg font-semibold">{statement.offerCount}</p>
                                        </div>
                                        {statement.errorMessage && (
                                            <div className="col-span-3">
                                                <p className="text-xs text-red-600">{statement.errorMessage}</p>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </TabsContent>

            <TabsContent value="upload">
                <ManualStatementUpload cards={cards} />
            </TabsContent>
        </Tabs>
    );
}

