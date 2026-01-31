"use client";

import { Eye, EyeOff, DollarSign, CreditCard, Wallet, ShieldAlert } from "lucide-react";
import { useBalanceVisibility } from "@/lib/balance-visibility";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

type DashboardKpisProps = {
  netAvailable: number;
  grossAvailable: number;
  grossPayable: number;
  bankAvailable: number;
  overdraftAvailable: number;
  overdraftLimit: number;
  overdraftUsed: number;
  creditAvailable: number;
  creditLimit: number;
  creditUsed: number;
};

const formatMoney = (value: number, hidden: boolean) =>
  hidden ? "•••" : `£${value.toFixed(2)}`;

export function DashboardKpis(props: DashboardKpisProps) {
  const {
    netAvailable,
    grossAvailable,
    grossPayable,
    bankAvailable,
    overdraftAvailable,
    overdraftLimit,
    overdraftUsed,
    creditAvailable,
    creditLimit,
    creditUsed,
  } = props;

  const visibility = useBalanceVisibility();
  const hidden = !visibility.visible;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
      <Link href="/cards#bank-accounts" className="group h-full">
        <Card className="group-hover:border-primary/40 transition-colors h-full flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Available Balance</CardTitle>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-muted-foreground hover:text-slate-900"
                onClick={(e) => {
                  e.preventDefault();
                  visibility.toggle();
                }}
              >
                {hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="text-2xl font-bold">{formatMoney(netAvailable, hidden)}</div>
            <p className="text-xs text-muted-foreground">
              After credit/overdraft payables.
            </p>
          </CardContent>
        </Card>
      </Link>

      <Card className="h-full flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Gross Available</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="flex-1">
          <div className="text-2xl font-bold">{formatMoney(grossAvailable, hidden)}</div>
          <p className="text-xs text-muted-foreground">
            Total available (bank + overdraft + cards).
          </p>
        </CardContent>
      </Card>

      <Card className="h-full flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Gross Payable</CardTitle>
          <ShieldAlert className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="flex-1">
          <div className="text-2xl font-bold">{formatMoney(grossPayable, hidden)}</div>
          <p className="text-xs text-muted-foreground">
            Debts due (accounts + overdraft + cards).
          </p>
        </CardContent>
      </Card>

      <Link href="/cards#bank-accounts" className="group h-full">
        <Card className="group-hover:border-primary/40 transition-colors h-full flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bank Account Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex-1">
            <div className="text-2xl font-bold">{formatMoney(bankAvailable, hidden)}</div>
            <p className="text-xs text-muted-foreground">Available across bank accounts.</p>
          </CardContent>
        </Card>
      </Link>

      <Link href="/cards#overdraft-accounts" className="group h-full">
        <Card className="group-hover:border-primary/40 transition-colors h-full flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdraft Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex-1">
            <div className="text-2xl font-bold">{formatMoney(overdraftAvailable, hidden)}</div>
            <p className="text-xs text-muted-foreground">
              Limit {formatMoney(overdraftLimit, hidden)} · Used {formatMoney(overdraftUsed, hidden)}
            </p>
          </CardContent>
        </Card>
      </Link>

      <Link href="/cards#credit-cards" className="group h-full">
        <Card className="group-hover:border-primary/40 transition-colors h-full flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credit Card Balance</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex-1">
            <div className="text-2xl font-bold">{formatMoney(creditAvailable, hidden)}</div>
            <p className="text-xs text-muted-foreground">
              Limit {formatMoney(creditLimit, hidden)} · Used {formatMoney(creditUsed, hidden)}
            </p>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
