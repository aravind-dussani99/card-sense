import Link from "next/link"
import { cn } from "@/lib/utils"
import { CreditCard, Home, PieChart, DollarSign, Receipt, Settings, RefreshCw } from "lucide-react"

export function MainNav({
    className,
    ...props
}: React.HTMLAttributes<HTMLElement>) {
    return (
        <nav
            className={cn("flex items-center space-x-4 lg:space-x-6", className)}
            {...props}
        >
            <Link
                href="/"
                className="text-sm font-medium transition-colors hover:text-primary"
            >
                <div className="flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    Dashboard
                </div>
            </Link>
            <Link
                href="/cards"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
                <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Cards & Accounts
                </div>
            </Link>
            <Link
                href="/transactions"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
                <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    Transactions
                </div>
            </Link>
            <Link
                href="/analytics"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
                <div className="flex items-center gap-2">
                    <PieChart className="h-4 w-4" />
                    Analytics
                </div>
            </Link>
            <Link
                href="/balances"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
                <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Balances
                </div>
            </Link>
            <Link
                href="/sync-workbench"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
                <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Sync Workbench
                </div>
            </Link>
            <Link
                href="/settings"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
                <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Settings
                </div>
            </Link>
        </nav>
    )
}
