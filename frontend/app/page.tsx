import { Metadata } from "next"
import Link from "next/link"
import { MainNav } from "@/components/main-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CreditCard, DollarSign, Gift } from "lucide-react"
import { BankTransactionList } from "@/components/bank-transaction-list"
import { AIInsights } from "@/components/ai-insights"
import { getCards } from "@/app/actions/card-actions"
import { getBankAccounts } from "@/app/actions/bank-actions"
import { getBankTransactions } from "@/app/actions/transaction-actions"
import { BankAccount, BankTransaction, Card as CardModel } from "@/lib/types"

export const metadata: Metadata = {
  title: "Dashboard - CardSense",
  description: "Track your credit cards and spending.",
}

export default async function DashboardPage() {
  const cards: CardModel[] = await getCards();
  const bankAccounts: BankAccount[] = await getBankAccounts();
  const recentTransactions: BankTransaction[] = await getBankTransactions(10);

  const toNumber = (value?: number | null) => (typeof value === "number" ? value : 0);
  const isOverdraft = (account: BankAccount) => {
    const type = (account.type || "").toLowerCase();
    const name = (account.name || "").toLowerCase();
    return type.includes("overdraft") || name.includes("overdraft");
  };
  const overdraftAccounts = bankAccounts.filter(isOverdraft);
  const standardAccounts = bankAccounts.filter((account) => !isOverdraft(account));

  const bankAvailable = standardAccounts.reduce(
    (sum, acct) => sum + toNumber(acct.availableBalance ?? acct.balance),
    0
  );
  const overdraftLimit = overdraftAccounts.reduce((sum, acct) => sum + toNumber(acct.limit), 0);
  const overdraftAvailable = overdraftAccounts.reduce(
    (sum, acct) => sum + toNumber(acct.availableBalance ?? acct.balance),
    0
  );
  const overdraftUsed = Math.max(0, overdraftLimit - overdraftAvailable);

  const creditLimit = cards.reduce((sum, card) => sum + toNumber(card.limit), 0);
  const creditUsed = cards.reduce((sum, card) => sum + toNumber(card.balance), 0);
  const creditAvailable = Math.max(0, creditLimit - creditUsed);

  const totalBalance = bankAvailable + overdraftAvailable + creditAvailable;

  return (
    <div className="flex flex-col min-h-screen">
      <div className="border-b bg-white/80 backdrop-blur-md shadow-sm">
        <div className="flex h-16 items-center px-4">
          <h1 className="text-xl font-bold mr-8 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">CardSense</h1>
          <MainNav className="mx-6" />
        </div>
      </div>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Link href="/cards#bank-accounts" className="group">
            <Card className="group-hover:border-primary/40 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Balance
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">£{totalBalance.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">
                  Combined available balance (bank, overdraft, credit cards)
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/cards#bank-accounts" className="group">
            <Card className="group-hover:border-primary/40 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Bank Account Balance
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">£{bankAvailable.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">
                  Available across all bank accounts
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/cards#overdraft-accounts" className="group">
            <Card className="group-hover:border-primary/40 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Overdraft Balance
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">£{overdraftAvailable.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">
                  Limit £{overdraftLimit.toFixed(2)} · Used £{overdraftUsed.toFixed(2)}
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/cards#credit-cards" className="group">
            <Card className="group-hover:border-primary/40 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Credit Card Balance
                </CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">£{creditAvailable.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">
                  Limit £{creditLimit.toFixed(2)} · Used £{creditUsed.toFixed(2)}
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/rewards" className="group">
            <Card className="group-hover:border-primary/40 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Rewards</CardTitle>
                <Gift className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">0 pts</div>
                <p className="text-xs text-muted-foreground">
                  Rewards balance will appear here
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>Recent Transactions</CardTitle>
                  <CardDescription>
                    Your latest bank transactions (last 10).
                  </CardDescription>
                </div>
                <Link href="/transactions">
                  <Button variant="outline" size="sm">Show all transactions</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <BankTransactionList
                transactions={recentTransactions.map((tx: BankTransaction) => ({
                  id: tx.id,
                  merchant: tx.merchant || tx.descriptionVia || "Unknown",
                  descriptionVia: tx.descriptionVia || tx.merchant || "",
                  category: tx.category || "Uncategorized",
                  amount: tx.amount,
                  currency: tx.currency || "USD",
                  date: tx.date,
                  account: tx.account ? { name: tx.account.name || "Account", type: tx.account.type || "Account" } : null,
                }))}
              />
            </CardContent>
          </Card>
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>AI Insights</CardTitle>
              <CardDescription>
                Smart suggestions for your spending.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AIInsights />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
