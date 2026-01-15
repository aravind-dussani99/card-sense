import { Brain, Lightbulb, AlertTriangle } from "lucide-react"
import { getInsights } from "@/app/actions/insights-actions"

export async function AIInsights() {
    const insights = await getInsights();

    if (insights.length === 0) {
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
        </div>
    )
}
