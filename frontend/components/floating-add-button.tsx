"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Plus, CreditCard, Receipt } from "lucide-react"
import { AddCardDialog } from "@/components/add-card-dialog"
import { AddTransactionDialog } from "@/components/add-transaction-dialog"
import { Card, Category } from "@/lib/types";

interface FloatingAddButtonProps {
    cards?: Card[];
    categories?: Category[];
}

export function FloatingAddButton({ cards = [], categories = [] }: FloatingAddButtonProps) {
    const [open, setOpen] = useState(false);
    const [addCardOpen, setAddCardOpen] = useState(false);
    const [addTransactionOpen, setAddTransactionOpen] = useState(false);

    const actions = [
        {
            id: "transaction",
            label: "Add Transaction",
            icon: Receipt,
            onClick: () => {
                setOpen(false);
                setAddTransactionOpen(true);
            },
            show: true,
        },
        {
            id: "card",
            label: "Add Card",
            icon: CreditCard,
            onClick: () => {
                setOpen(false);
                setAddCardOpen(true);
            },
            show: true,
        },
    ].filter(action => action.show);

    return (
        <>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        size="lg"
                        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl z-[9998] hover:scale-110 transition-transform bg-primary text-primary-foreground"
                    >
                        <Plus className="h-6 w-6" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="end">
                    <div className="space-y-1">
                        {actions.map((action) => {
                            const Icon = action.icon;
                            return (
                                <Button
                                    key={action.id}
                                    variant="ghost"
                                    className="w-full justify-start"
                                    onClick={action.onClick}
                                >
                                    <Icon className="mr-2 h-4 w-4" />
                                    {action.label}
                                </Button>
                            );
                        })}
                    </div>
                </PopoverContent>
            </Popover>
            
            {/* Dialogs that we can trigger programmatically */}
            <AddCardDialog open={addCardOpen} onOpenChange={setAddCardOpen} />
            <AddTransactionDialog 
                cards={cards} 
                categories={categories} 
                open={addTransactionOpen} 
                onOpenChange={setAddTransactionOpen} 
            />
        </>
    );
}
