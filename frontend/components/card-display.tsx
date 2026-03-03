"use client";

import { CardCountdown } from "@/components/card-countdown";
import { formatAmount } from "@/lib/utils";

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
                                {`**** **** **** ${card.last4}`}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Expiry and CVV */}
                <div className="flex items-center gap-4">
                    <div>
                        <div className="text-xs text-muted-foreground">Exp</div>
                        <div className="text-sm font-medium">
                            {"••/••"}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div>
                            <div className="text-xs text-muted-foreground">CVV</div>
                            <div className="text-sm font-mono">
                                {"***"}
                            </div>
                        </div>
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
                        <div className="text-sm font-semibold">{formatAmount(card.limit, { currency: "$" })}</div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground">Available Credit Limit</div>
                        <div className="text-sm font-semibold text-green-600">
                            {formatAmount(availableCredit, { currency: "$" })}
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
                        <span>{formatAmount(card.limit, { currency: "$" })}</span>
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
