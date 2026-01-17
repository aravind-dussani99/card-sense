import { Metadata } from "next"
import { MainNav } from "@/components/main-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CreditCard, DollarSign, TrendingUp, Activity } from "lucide-react"
import { BankTransactionList } from "@/components/bank-transaction-list"
import { AIInsights } from "@/components/ai-insights"
import { getCards } from "@/app/actions/card-actions"
import { getCategories } from "@/app/actions/category-actions"
import { getSpendingByMerchant } from "@/app/actions/analytics-actions"
import { MerchantSpendChart } from "@/components/merchant-spend-chart"
import { getBankTransactions } from "@/app/actions/transaction-actions"

export const metadata: Metadata = {
  title: "Dashboard - CardSense",
  description: "Track your credit cards and spending.",
}

export default async function DashboardPage() {
  const cards: any[] = await getCards();
  const categories = await getCategories();
  const merchantData = await getSpendingByMerchant();
  const recentTransactions = await getBankTransactions(10);

  const totalBalance = cards.reduce((acc, card) => acc + card.balance, 0);
  const activeCards = cards.length;
  const totalLimit = cards.reduce((acc, card) => acc + card.limit, 0);
  const creditUtilization = totalLimit > 0 ? (totalBalance / totalLimit) * 100 : 0;

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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Balance
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalBalance.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                +20.1% from last month
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Active Cards
              </CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeCards}</div>
              <p className="text-xs text-muted-foreground">
                2 cards expiring soon
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Rewards</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12,340 pts</div>
              <p className="text-xs text-muted-foreground">
                Worth approx $123.40
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Credit Utilization
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{creditUtilization.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                {creditUtilization < 30 ? "Excellent (Below 30%)" : "High Utilization"}
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>
                Your latest bank transactions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BankTransactionList
                transactions={recentTransactions.map((tx: any) => ({
                  id: tx.id,
                  merchant: tx.merchant || tx.descriptionVia || "Unknown",
                  descriptionVia: tx.descriptionVia || tx.merchant || "",
                  category: tx.category || "Uncategorized",
                  amount: tx.amount,
                  currency: tx.currency || "USD",
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
        <div className="grid gap-4 md:grid-cols-1">
          <MerchantSpendChart data={merchantData} />
        </div>
      </div>
    </div>
  )
}
