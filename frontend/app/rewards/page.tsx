import { Metadata } from "next"
import { MainNav } from "@/components/main-nav"
import { AuthMenu } from "@/components/auth-menu"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = {
    title: "Rewards - CardSense",
    description: "Track reward points, redemption options, and history.",
}

export default async function RewardsPage() {
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
                    <h2 className="text-3xl font-bold tracking-tight">Rewards</h2>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Card>
                        <CardHeader>
                            <CardTitle>Total Reward Points</CardTitle>
                            <CardDescription>Consolidated points across all cards.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">0 pts</div>
                            <p className="text-xs text-muted-foreground">Connect card reward providers to populate.</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Redemptions</CardTitle>
                            <CardDescription>Track reward redemptions and conversions.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">No redemptions yet.</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Offers &amp; Deals</CardTitle>
                            <CardDescription>Suggested offers to redeem points.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">Offers will appear here.</p>
                        </CardContent>
                    </Card>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>Reward Transaction History</CardTitle>
                        <CardDescription>Reward point accruals per transaction.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">No reward transactions yet.</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
