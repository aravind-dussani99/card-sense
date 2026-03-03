"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { MainNav } from "@/components/main-nav";
import { AuthMenu } from "@/components/auth-menu";

type MetricsResponse = {
  metrics: {
    totalUsers: number;
    verifiedUsers: number;
    activeUsersLast30Days: number;
    totalCards: number;
    totalBankAccounts: number;
    totalBankTransactions: number;
    totalManualTransactions: number;
    totalBankConnections: number;
  };
};

export default function AdminPage() {
  const [metrics, setMetrics] = useState<MetricsResponse["metrics"] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const result = await apiFetch<MetricsResponse>("/api/admin/metrics");
        setMetrics(result.metrics);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load metrics");
      }
    };
    void load();
  }, []);

  if (error || !metrics) {
    const title = error ? "Access restricted" : "Loading overview data.";
    return (
      <div className="flex flex-col min-h-screen">
        <div className="border-b bg-white/80 backdrop-blur-md shadow-sm">
          <div className="flex h-16 items-center px-4">
            <h1 className="text-xl font-bold mr-8 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              CardSense
            </h1>
            <MainNav className="mx-6" />
            <div className="ml-auto flex items-center gap-3">
              <AuthMenu />
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-3xl py-12">
          <Card>
            <CardHeader>
              <CardTitle>Admin Metrics</CardTitle>
              <CardDescription>{title}</CardDescription>
            </CardHeader>
            <CardContent>
              {error ? (
                <p className="text-sm text-red-600">{error}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Loading metrics...</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const items = [
    { label: "Total Users", value: metrics.totalUsers },
    { label: "Verified Users", value: metrics.verifiedUsers },
    { label: "Active (30 days)", value: metrics.activeUsersLast30Days },
    { label: "Bank Connections", value: metrics.totalBankConnections },
    { label: "Bank Accounts", value: metrics.totalBankAccounts },
    { label: "Cards", value: metrics.totalCards },
    { label: "Bank Transactions", value: metrics.totalBankTransactions },
    { label: "Manual Transactions", value: metrics.totalManualTransactions },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <div className="border-b bg-white/80 backdrop-blur-md shadow-sm">
        <div className="flex h-16 items-center px-4">
          <h1 className="text-xl font-bold mr-8 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            CardSense
          </h1>
          <MainNav className="mx-6" />
          <div className="ml-auto flex items-center gap-3">
            <AuthMenu />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-5xl py-12">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Admin Metrics</h1>
          <p className="text-sm text-muted-foreground">
            Aggregate usage data only. No personal details are shown.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <Card key={item.label}>
              <CardHeader className="pb-2">
                <CardDescription>{item.label}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{item.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
