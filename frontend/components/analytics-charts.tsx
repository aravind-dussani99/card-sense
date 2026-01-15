"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts"

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF1943', '#00D4FF', '#FF6B9D'];

interface AnalyticsChartsProps {
    categoryData: { name: string; value: number }[];
    monthlyData: { month: string; total: number }[];
    cardData: { name: string; value: number }[];
    merchantData?: { name: string; value: number }[];
}

export function AnalyticsCharts({ categoryData, monthlyData, cardData, merchantData = [] }: AnalyticsChartsProps) {
    const formatMonth = (month: string) => {
        const [year, monthNum] = month.split("-");
        const date = new Date(parseInt(year), parseInt(monthNum) - 1);
        return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    };

    const formatCurrency = (value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    if (categoryData.length === 0 && monthlyData.length === 0 && cardData.length === 0 && merchantData.length === 0) {
        return (
            <div className="flex items-center justify-center h-96 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground">No data available. Add some transactions to see analytics.</p>
            </div>
        );
    }

    return (
        <div className="grid gap-4 md:grid-cols-2">
            {categoryData.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Spending by Category</CardTitle>
                        <CardDescription>Breakdown of your spending across different categories</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={categoryData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {categoryData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={formatCurrency} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {monthlyData.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Monthly Spending Trend</CardTitle>
                        <CardDescription>Your spending over the last 6 months</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis 
                                    dataKey="month" 
                                    tickFormatter={formatMonth}
                                    angle={-45}
                                    textAnchor="end"
                                    height={80}
                                />
                                <YAxis tickFormatter={(value) => `$${value.toLocaleString()}`} />
                                <Tooltip formatter={formatCurrency} />
                                <Bar dataKey="total" fill="#0088FE" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {cardData.length > 0 && (
                <Card className={categoryData.length > 0 && monthlyData.length > 0 ? "md:col-span-2" : ""}>
                    <CardHeader>
                        <CardTitle>Spending by Account</CardTitle>
                        <CardDescription>Total spending by account</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={cardData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" tickFormatter={(value) => `$${value.toLocaleString()}`} />
                                <YAxis dataKey="name" type="category" width={120} />
                                <Tooltip formatter={formatCurrency} />
                                <Bar dataKey="value" fill="#00C49F" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {merchantData.length > 0 && (
                <Card className={categoryData.length > 0 && monthlyData.length > 0 ? "md:col-span-2" : ""}>
                    <CardHeader>
                        <CardTitle>Top Merchants / Descriptions</CardTitle>
                        <CardDescription>Highest spend by merchant or description</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={320}>
                            <BarChart data={merchantData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" tickFormatter={(value) => `$${value.toLocaleString()}`} />
                                <YAxis dataKey="name" type="category" width={160} />
                                <Tooltip formatter={formatCurrency} />
                                <Bar dataKey="value" fill="#FF8042" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
