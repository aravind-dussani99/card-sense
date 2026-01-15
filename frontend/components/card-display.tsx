"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardCountdown } from "@/components/card-countdown";

interface CardDisplayProps {
    card: {
        id: string;
        name: string;
        nameOnCard?: string | null;
        bank: string;
        cardType?: { name: string } | null;
        cardCategory?: string | null;
        last4: string;
        fullCardNumber?: string | null;
        expiryDate?: string | null;
        cvv?: string | null;
        limit: number;
        balance: number;
        color: string;
        cutoffDate: number;
        dueDate: number;
        last3DueDates?: string | null;
    };
}

export function CardDisplay({ card }: CardDisplayProps) {
    const [showCardNumber, setShowCardNumber] = useState(false);
    const [showCVV, setShowCVV] = useState(false);
    const [cardNumberTimeout, setCardNumberTimeout] = useState<NodeJS.Timeout | null>(null);
    const [cvvTimeout, setCvvTimeout] = useState<NodeJS.Timeout | null>(null);

    // Auto-hide card number after 20 seconds
    useEffect(() => {
        if (showCardNumber) {
            if (cardNumberTimeout) clearTimeout(cardNumberTimeout);
            const timeout = setTimeout(() => {
                setShowCardNumber(false);
            }, 20000);
            setCardNumberTimeout(timeout);
        }
        return () => {
            if (cardNumberTimeout) clearTimeout(cardNumberTimeout);
        };
    }, [showCardNumber]);

    // Auto-hide CVV after 20 seconds
    useEffect(() => {
        if (showCVV) {
            if (cvvTimeout) clearTimeout(cvvTimeout);
            const timeout = setTimeout(() => {
                setShowCVV(false);
            }, 20000);
            setCvvTimeout(timeout);
        }
        return () => {
            if (cvvTimeout) clearTimeout(cvvTimeout);
        };
    }, [showCVV]);

    const formatCardNumber = (fullNumber: string | null | undefined) => {
        if (!fullNumber) return `**** **** **** ${card.last4}`;
        // Format as XXXX XXXX XXXX XXXX
        const cleaned = fullNumber.replace(/\s/g, '');
        return cleaned.match(/.{1,4}/g)?.join(' ') || fullNumber;
    };

    const isAccount = card.cardCategory === "Bank Account";
    const availableCredit = card.limit - card.balance;
    const usedPercentage = card.limit > 0 ? (card.balance / card.limit) * 100 : 0;
    const availablePercentage = 100 - usedPercentage;

    return (
        <div className="border rounded-lg bg-white shadow-sm">
            {/* Card Details Section */}
            <div className="p-4 border-b space-y-3">
                {/* Type Badge */}
                {isAccount && (
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                            Bank Account
                        </span>
                    </div>
                )}
                {/* Name on Card and Card Number */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-xs text-muted-foreground">{isAccount ? "Account Name" : "Name on Card"}</div>
                            <div className="text-sm font-medium">
                                {card.nameOnCard || card.name}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <div className="text-xs text-muted-foreground">{isAccount ? "Account Number" : "Card Number"}</div>
                            <div className="text-sm font-mono tracking-wider">
                                {showCardNumber && card.fullCardNumber
                                    ? formatCardNumber(card.fullCardNumber)
                                    : `**** **** **** ${card.last4}`}
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setShowCardNumber(!showCardNumber)}
                        >
                            {showCardNumber ? (
                                <EyeOff className="h-4 w-4" />
                            ) : (
                                <Eye className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </div>

                {/* Expiry and CVV */}
                <div className="flex items-center gap-4">
                    <div>
                        <div className="text-xs text-muted-foreground">Exp</div>
                        <div className="text-sm font-medium">
                            {card.expiryDate || "N/A"}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div>
                            <div className="text-xs text-muted-foreground">CVV</div>
                            <div className="text-sm font-mono">
                                {showCVV && card.cvv ? card.cvv : "***"}
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setShowCVV(!showCVV)}
                        >
                            {showCVV ? (
                                <EyeOff className="h-4 w-4" />
                            ) : (
                                <Eye className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </div>

                {/* Bank, Network, Card Type */}
                <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                    <div>
                        <div className="text-xs text-muted-foreground">Bank Name</div>
                        <div className="text-xs font-medium">{card.bank}</div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground">Card Network</div>
                        <div className="text-xs font-medium">{card.cardType?.name || "N/A"}</div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground">Card Type</div>
                        <div className="text-xs font-medium">{card.cardCategory || "N/A"}</div>
                    </div>
                </div>
            </div>

            {/* Credit Limit Section */}
            <div className="p-4 border-b space-y-3">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <div className="text-xs text-muted-foreground">Total Credit Limit</div>
                        <div className="text-sm font-semibold">${card.limit.toLocaleString()}</div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground">Available Credit Limit</div>
                        <div className="text-sm font-semibold text-green-600">
                            ${availableCredit.toLocaleString()}
                        </div>
                    </div>
                </div>

                {/* Progress Bar with Red/Green Colors */}
                <div className="space-y-1">
                    <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden flex">
                        {usedPercentage > 0 && (
                            <div
                                className="bg-red-500 h-full transition-all"
                                style={{ width: `${usedPercentage}%` }}
                            />
                        )}
                        {availablePercentage > 0 && (
                            <div
                                className="bg-green-500 h-full transition-all"
                                style={{ width: `${availablePercentage}%` }}
                            />
                        )}
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>0</span>
                        <span>${card.limit.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            {/* Statement Dates Section */}
            <div className="p-4">
                <CardCountdown card={card} />
            </div>
        </div>
    );
}

