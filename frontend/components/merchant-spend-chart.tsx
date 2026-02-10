"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAmount } from "@/lib/utils";

export function MerchantSpendChart({ data }: { data: { name: string; value: number }[] }) {
    if (!data.length) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Merchant Spend Patterns</CardTitle>
                    <CardDescription>Top merchants and descriptions</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                        No transactions yet.
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Merchant Spend Patterns</CardTitle>
                <CardDescription>Top merchants and descriptions</CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tickFormatter={(value) => formatAmount(value, { currency: "$" })} />
                        <YAxis dataKey="name" type="category" width={160} />
                        <Tooltip formatter={(value: number) => formatAmount(value, { currency: "$" })} />
                        <Bar dataKey="value" fill="#6366F1" />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
