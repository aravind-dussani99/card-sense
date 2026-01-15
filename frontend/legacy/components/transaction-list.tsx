import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { getTransactions } from "@/app/actions/transaction-actions"
import { getCards } from "@/app/actions/card-actions"
import { getCategories } from "@/app/actions/category-actions"
import { EditTransactionDialog } from "@/components/edit-transaction-dialog"

export async function TransactionList() {
    const transactions = await getTransactions();
    const cards = await getCards();
    const categories = await getCategories();

    if (transactions.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                No transactions yet. Add your first transaction!
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {transactions.slice(0, 10).map((transaction) => (
                <div key={transaction.id} className="flex items-center gap-4">
                    <Avatar className="h-9 w-9">
                        <AvatarFallback>{transaction.merchant[0]}</AvatarFallback>
                    </Avatar>
                    <div className="ml-4 flex-1 space-y-1">
                        <p className="text-sm font-medium leading-none">{transaction.merchant}</p>
                        <p className="text-sm text-muted-foreground">
                            {transaction.category} {transaction.card ? `• ${transaction.card.name}` : ''}
                        </p>
                    </div>
                    <div className="ml-auto font-medium">
                        -${transaction.amount.toFixed(2)}
                    </div>
                    <EditTransactionDialog transaction={transaction} cards={cards} categories={categories} />
                </div>
            ))}
        </div>
    )
}
