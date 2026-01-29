"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Edit2 } from "lucide-react";
import { updateTransaction } from "@/app/actions/transaction-actions";
import { getCategories } from "@/app/actions/category-actions";
import { Card, Category, SubCategory } from "@/lib/types";

type LegacyTransaction = {
    id: string;
    cardId?: string;
    category?: string;
    subCategory?: string;
    transactionType?: "expense" | "loan_given" | "loan_received";
    loanTo?: string;
    loanFrom?: string;
    date: string | Date;
    merchant?: string;
    amount?: number;
    description?: string;
};

interface EditTransactionDialogProps {
    transaction: LegacyTransaction;
    cards: Card[];
    categories: Category[];
}

export function EditTransactionDialog({ transaction, cards, categories: initialCategories }: EditTransactionDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [cardId, setCardId] = useState<string>(transaction.cardId || "");
    const [category, setCategory] = useState<string>(transaction.category || "");
    const [subCategory, setSubCategory] = useState<string>(transaction.subCategory || "");
    const [categories, setCategories] = useState<Category[]>(initialCategories || []);

    useEffect(() => {
        if (open && (!initialCategories || initialCategories.length === 0)) {
            getCategories().then(setCategories);
        }
    }, [open, initialCategories]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.currentTarget);

        const data = {
            cardId: cardId || undefined,
            merchant: formData.get("merchant") as string,
            amount: Number(formData.get("amount")),
            category: category || (formData.get("category") as string),
            subCategory: subCategory || undefined,
            description: formData.get("description") as string,
            date: formData.get("date") ? new Date(formData.get("date") as string) : new Date(transaction.date),
            transactionType: transaction.transactionType || "expense",
            loanTo: transaction.loanTo || undefined,
            loanFrom: transaction.loanFrom || undefined,
        };

        const result = await updateTransaction(transaction.id, data);
        setLoading(false);

        if (result.success) {
            setOpen(false);
            window.location.reload();
        } else {
            alert("Failed to update transaction");
        }
    };

    const selectedCat = categories.find((c) => c.name === category);
    const subCategories: SubCategory[] = selectedCat?.subCategories || [];

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(true)}>
                <Edit2 className="h-4 w-4" />
            </Button>
            <DialogContent className="sm:max-w-[520px] bg-white">
                <DialogHeader>
                    <DialogTitle>Edit Transaction</DialogTitle>
                    <DialogDescription>
                        Update the transaction details.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="cardId" className="text-right">
                                Card
                            </Label>
                            <Select value={cardId} onValueChange={setCardId}>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select a card" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">None</SelectItem>
                                    {cards.map((card) => (
                                        <SelectItem key={card.id} value={card.id}>
                                            {card.name} (••{card.last4})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="merchant" className="text-right">
                                Merchant
                            </Label>
                            <Input
                                id="merchant"
                                name="merchant"
                                defaultValue={transaction.merchant}
                                placeholder="e.g. Amazon"
                                className="col-span-3"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="amount" className="text-right">
                                Amount
                            </Label>
                            <Input
                                id="amount"
                                name="amount"
                                type="number"
                                step="0.01"
                                defaultValue={transaction.amount}
                                placeholder="0.00"
                                className="col-span-3"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="category" className="text-right">
                                Category
                            </Label>
                            <Select value={category} onValueChange={(val) => {
                                setCategory(val);
                                setSubCategory("");
                            }} required>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((cat) => (
                                        <SelectItem key={cat.id} value={cat.name}>
                                            {cat.icon && <span className="mr-2">{cat.icon}</span>}
                                            {cat.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {category && subCategories.length > 0 && (
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="subCategory" className="text-right">
                                    Sub-Category
                                </Label>
                                <Select value={subCategory || "all"} onValueChange={(val) => setSubCategory(val === "all" ? "" : val)}>
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue placeholder="Select sub-category (optional)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">None</SelectItem>
                                            {subCategories.map((sub: SubCategory) => (
                                                <SelectItem key={sub.id} value={sub.name}>
                                                    {sub.name}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="date" className="text-right">
                                Date
                            </Label>
                            <Input
                                id="date"
                                name="date"
                                type="date"
                                defaultValue={new Date(transaction.date).toISOString().split('T')[0]}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="description" className="text-right">
                                Note
                            </Label>
                            <Input
                                id="description"
                                name="description"
                                defaultValue={transaction.description || ""}
                                placeholder="Optional note"
                                className="col-span-3"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Updating..." : "Update Transaction"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
