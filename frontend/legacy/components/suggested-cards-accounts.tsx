"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CreditCard, Building2, Plus } from "lucide-react";
import { AddCardDialog } from "./add-card-dialog";
import { AddAccountDialog } from "./add-account-dialog";
import { useState } from "react";

interface SuggestedCardOrAccount {
    type: 'card' | 'account';
    last4?: string;
    accountNumber?: string;
    bankName?: string;
    transactionCount: number;
    totalAmount: number;
    firstSeen: Date;
    lastSeen: Date;
}

interface SuggestedCardsAccountsProps {
    suggestions: SuggestedCardOrAccount[];
}

export function SuggestedCardsAccounts({ suggestions }: SuggestedCardsAccountsProps) {
    const [addCardOpen, setAddCardOpen] = useState(false);
    const [addAccountOpen, setAddAccountOpen] = useState(false);
    const [selectedSuggestion, setSelectedSuggestion] = useState<SuggestedCardOrAccount | null>(null);

    if (suggestions.length === 0) {
        return null;
    }

    const handleAddCard = (suggestion: SuggestedCardOrAccount) => {
        setSelectedSuggestion(suggestion);
        setAddCardOpen(true);
    };

    const handleAddAccount = (suggestion: SuggestedCardOrAccount) => {
        setSelectedSuggestion(suggestion);
        setAddAccountOpen(true);
    };

    return (
        <Card className="mb-6 border-orange-200 bg-orange-50">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-900">
                    <AlertCircle className="h-5 w-5" />
                    Suggested Cards & Accounts
                </CardTitle>
                <CardDescription className="text-orange-700">
                    We found transactions for cards/accounts that aren't in your database. Create them to better track your finances.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {suggestions.map((suggestion, index) => (
                        <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-200"
                        >
                            <div className="flex items-center gap-3">
                                {suggestion.type === 'card' ? (
                                    <CreditCard className="h-5 w-5 text-orange-600" />
                                ) : (
                                    <Building2 className="h-5 w-5 text-orange-600" />
                                )}
                                <div>
                                    <p className="font-medium text-gray-900">
                                        {suggestion.type === 'card' 
                                            ? `Card ending in **${suggestion.last4 || 'Unknown'}`
                                            : suggestion.accountNumber
                                                ? `Account ending in **${suggestion.accountNumber.slice(-4)}`
                                                : 'Account (Unknown)'
                                        }
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        {suggestion.bankName && `${suggestion.bankName} • `}
                                        {suggestion.transactionCount} transaction{suggestion.transactionCount > 1 ? 's' : ''} • 
                                        ₹{suggestion.totalAmount.toLocaleString('en-IN')}
                                    </p>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                onClick={() => suggestion.type === 'card' ? handleAddCard(suggestion) : handleAddAccount(suggestion)}
                                className="bg-orange-600 hover:bg-orange-700"
                            >
                                <Plus className="h-4 w-4 mr-1" />
                                Add {suggestion.type === 'card' ? 'Card' : 'Account'}
                            </Button>
                        </div>
                    ))}
                </div>
            </CardContent>
            {addCardOpen && (
                <AddCardDialog 
                    open={addCardOpen} 
                    onOpenChange={setAddCardOpen}
                    prefillData={selectedSuggestion?.type === 'card' ? {
                        last4: selectedSuggestion.last4 || '',
                        bank: selectedSuggestion.bankName || '',
                    } : undefined}
                />
            )}
            {addAccountOpen && (
                <AddAccountDialog 
                    open={addAccountOpen} 
                    onOpenChange={setAddAccountOpen}
                    prefillData={selectedSuggestion?.type === 'account' ? {
                        accountNumber: selectedSuggestion.accountNumber || '',
                        bank: selectedSuggestion.bankName || '',
                    } : undefined}
                />
            )}
        </Card>
    );
}

