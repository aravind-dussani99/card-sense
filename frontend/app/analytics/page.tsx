import { Metadata } from "next"
import { MainNav } from "@/components/main-nav"
import { AuthMenu } from "@/components/auth-menu"
import { getSpendingByCategory, getMonthlySpending, getSpendingByCard, getSpendingByMerchant } from "@/app/actions/analytics-actions"
import { AnalyticsCharts } from "@/components/analytics-charts"

export const metadata: Metadata = {
    title: "Analytics - CardSense",
    description: "Analyze your spending habits.",
}

export default async function AnalyticsPage() {
    const categoryData = await getSpendingByCategory();
    const monthlyData = await getMonthlySpending();
    const cardData = await getSpendingByCard();
    const merchantData = await getSpendingByMerchant();

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
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex items-center justify-between space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
                </div>
                <AnalyticsCharts 
                    categoryData={categoryData}
                    monthlyData={monthlyData}
                    cardData={cardData}
                    merchantData={merchantData}
                />
            </div>
        </div>
    )
}
