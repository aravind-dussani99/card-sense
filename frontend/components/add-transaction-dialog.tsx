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
    DialogTrigger,
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
import { Plus } from "lucide-react";
import { addTransaction } from "@/app/actions/transaction-actions";
import { getCategories } from "@/app/actions/category-actions";

interface AddTransactionDialogProps {
    cards: any[];
    categories?: any[];
}

interface AddTransactionDialogInternalProps extends AddTransactionDialogProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function AddTransactionDialog({ cards, categories: initialCategories, open: controlledOpen, onOpenChange }: AddTransactionDialogInternalProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
    const setOpen = onOpenChange || setInternalOpen;
    const [loading, setLoading] = useState(false);
    const [cardId, setCardId] = useState<string>("");
    const [category, setCategory] = useState<string>("");
    const [subCategory, setSubCategory] = useState<string>("");
    const [categories, setCategories] = useState<any[]>(initialCategories || []);

    useEffect(() => {
        if (!initialCategories || initialCategories.length === 0) {
            getCategories().then(setCategories);
        }
    }, [initialCategories]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.currentTarget);

        const data = {
            cardId: cardId || (formData.get("cardId") as string),
            merchant: formData.get("merchant") as string,
            amount: Number(formData.get("amount")),
            category: category || (formData.get("category") as string),
            subCategory: subCategory || undefined,
            description: formData.get("description") as string,
            date: formData.get("date") ? new Date(formData.get("date") as string) : new Date(),
        };

        const result = await addTransaction(data);
        setLoading(false);

        if (result.success) {
            setOpen(false);
            setCardId("");
            setCategory("");
            setSubCategory("");
            (e.target as HTMLFormElement).reset();
        } else {
            alert("Failed to add transaction");
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {controlledOpen === undefined && (
                <DialogTrigger asChild>
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Add Transaction
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[520px] bg-white">
                <DialogHeader>
                    <DialogTitle>Add New Transaction</DialogTitle>
                    <DialogDescription>
                        Record a new transaction for one of your cards.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="cardId" className="text-right">
                                Card
                            </Label>
                            <Select name="cardId" value={cardId} onValueChange={setCardId} required>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select a card" />
                                </SelectTrigger>
                                <SelectContent>
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
                                placeholder="0.00"
                                className="col-span-3"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="category" className="text-right">
                                Category
                            </Label>
                            <Select name="category" value={category} onValueChange={(val) => {
                                setCategory(val);
                                setSubCategory(""); // Reset sub-category when category changes
                            }} required>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.length === 0 ? (
                                        <SelectItem value="all" disabled>No categories available</SelectItem>
                                    ) : (
                                        categories.map((cat) => (
                                            <SelectItem key={cat.id} value={cat.name}>
                                                {cat.icon && <span className="mr-2">{cat.icon}</span>}
                                                {cat.name}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        {category && (() => {
                            const selectedCat = categories.find(c => c.name === category);
                            const subCategories = selectedCat?.subCategories || [];
                            return subCategories.length > 0 ? (
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
                                            {subCategories.map((sub: any) => (
                                                <SelectItem key={sub.id} value={sub.name}>
                                                    {sub.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : null;
                        })()}
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="date" className="text-right">
                                Date
                            </Label>
                            <Input
                                id="date"
                                name="date"
                                type="date"
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
                                placeholder="Optional note"
                                className="col-span-3"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Adding..." : "Add Transaction"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
