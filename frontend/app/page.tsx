import { Metadata } from "next"
import Link from "next/link"
import { MainNav } from "@/components/main-nav"
import { AuthMenu } from "@/components/auth-menu"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BankTransactionList } from "@/components/bank-transaction-list"
import { AIInsights } from "@/components/ai-insights"
import { getCards } from "@/app/actions/card-actions"
import { getBankAccounts } from "@/app/actions/bank-actions"
import { getBankTransactions } from "@/app/actions/transaction-actions"
import { BankAccount, BankTransaction, Card as CardModel } from "@/lib/types"
import { DashboardKpis } from "@/components/dashboard-kpis"

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
  const cardAccounts = bankAccounts.filter((account) =>
    (account.type || "").toLowerCase().includes("card")
  );
  const standardAccounts = bankAccounts.filter(
    (account) => !isOverdraft(account) && !(account.type || "").toLowerCase().includes("card")
  );

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

  const cardAccountLimit = cardAccounts.reduce((sum, acct) => sum + toNumber(acct.limit), 0);
  const cardAccountAvailable = cardAccounts.reduce((sum, acct) => {
    if (typeof acct.availableBalance === "number") return sum + acct.availableBalance;
    if (typeof acct.limit === "number" && typeof acct.balance === "number") {
      return sum + Math.max(0, acct.limit - acct.balance);
    }
    return sum;
  }, 0);
  const cardAccountUsed = cardAccounts.reduce((sum, acct) => {
    if (typeof acct.limit === "number" && typeof acct.availableBalance === "number") {
      return sum + Math.max(0, acct.limit - acct.availableBalance);
    }
    if (typeof acct.balance === "number") return sum + Math.max(0, acct.balance);
    return sum;
  }, 0);
  const manualCardLimit = cards.reduce((sum, card) => sum + toNumber(card.limit), 0);
  const manualCardUsed = cards.reduce((sum, card) => sum + toNumber(card.balance), 0);
  const creditLimit = manualCardLimit + cardAccountLimit;
  const creditUsed = manualCardUsed + cardAccountUsed;
  const creditAvailable = Math.max(0, creditLimit - creditUsed);

  const grossAvailable = bankAvailable + overdraftAvailable + creditAvailable;
  const bankNegative = standardAccounts.reduce(
    (sum, acct) => sum + Math.max(0, -(acct.balance ?? 0)),
    0
  );
  const grossPayable = bankNegative + overdraftUsed + creditUsed;
  const netAvailable = bankAvailable + overdraftAvailable - creditUsed;

  return (
    <div className="flex flex-col min-h-screen">
      <div className="border-b bg-white/80 backdrop-blur-md shadow-sm">
        <div className="flex h-16 items-center px-4">
          <h1 className="text-xl font-bold mr-8 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">CardSense</h1>
          <MainNav className="mx-6" />
          <div className="ml-auto flex items-center gap-3">
            <AuthMenu />
          </div>
        </div>
      </div>
      <div className="space-y-4 px-8 pt-6 pb-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        </div>
        <DashboardKpis
          netAvailable={netAvailable}
          grossAvailable={grossAvailable}
          grossPayable={grossPayable}
          bankAvailable={bankAvailable}
          overdraftAvailable={overdraftAvailable}
          overdraftLimit={overdraftLimit}
          overdraftUsed={overdraftUsed}
          creditAvailable={creditAvailable}
          creditLimit={creditLimit}
          creditUsed={creditUsed}
        />
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
                <Link href="/transactions" className="inline-flex">
                  <Button variant="outline" size="sm" className="cursor-pointer">Show all transactions</Button>
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
