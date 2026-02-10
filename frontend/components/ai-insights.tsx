import { Brain, Lightbulb, AlertTriangle } from "lucide-react"
import { getInsights } from "@/app/actions/insights-actions"
import { getDirectDebits } from "@/app/actions/transaction-actions"
import { formatAmount, formatDate } from "@/lib/utils"

export async function AIInsights() {
    const insights = await getInsights();
    const directDebits = await getDirectDebits();
    const upcoming = directDebits.upcoming || [];
    const lastMonth = directDebits.lastMonth || [];
    const hasDirectDebits = upcoming.length > 0 || lastMonth.length > 0;

    if (insights.length === 0 && !hasDirectDebits) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                No insights available yet. Add some cards and transactions to get started.
            </div>
        );
    }

    const getIcon = (type: string) => {
        switch (type) {
            case "tip":
                return <Lightbulb className="h-5 w-5 text-yellow-500 mt-0.5 shrink-0" />;
            case "alert":
                return <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />;
            default:
                return <Brain className="h-5 w-5 text-primary mt-0.5 shrink-0" />;
        }
    };

    return (
        <div className="space-y-4">
            {insights.map((insight, index) => (
                <div key={index} className="bg-secondary/50 p-4 rounded-lg flex gap-3 items-start">
                    {getIcon(insight.type)}
                    <div>
                        <p className="text-sm font-medium">{insight.title}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            {insight.message}
                        </p>
                    </div>
                </div>
            ))}
            <details className="rounded-lg border p-4">
                <summary className="cursor-pointer list-none text-sm font-medium">
                    Direct Debits
                    <span className="block text-xs text-muted-foreground mt-1">
                        Track recurring debits to review and cancel anything you do not need.
                    </span>
                </summary>
                <div className="mt-3 space-y-3 text-sm">
                    <div>
                        <div className="text-xs font-semibold uppercase text-muted-foreground">Next month</div>
                        {upcoming.length === 0 ? (
                            <p className="text-muted-foreground">No direct debits predicted yet.</p>
                        ) : (
                            <div className="space-y-2">
                                {upcoming.slice(0, 6).map((item) => (
                                    <div key={`${item.name}-${item.expectedDate}`} className="flex items-center justify-between">
                                        <div>
                                            <div className="font-medium">{item.name}</div>
                                            <div className="text-xs text-muted-foreground">
                                                Expected {formatDate(item.expectedDate)}
                                            </div>
                                        </div>
                                        <div className="font-semibold">{formatAmount(item.expectedAmount, { currency: "£" })}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div>
                        <div className="text-xs font-semibold uppercase text-muted-foreground">Last month</div>
                        {lastMonth.length === 0 ? (
                            <p className="text-muted-foreground">No direct debits last month.</p>
                        ) : (
                            <div className="space-y-2">
                                {lastMonth.slice(0, 6).map((item) => (
                                    <div key={item.id} className="flex items-center justify-between">
                                        <div>
                                            <div className="font-medium">{item.name}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {formatDate(item.date)}
                                            </div>
                                        </div>
                                        <div className="font-semibold">
                                            {formatAmount(item.amount, { currency: item.currency || "£" })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </details>
        </div>
    )
}
