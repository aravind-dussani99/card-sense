"use client";

import { useMemo } from "react";

interface CardCountdownProps {
    card: {
        cutoffDate: number;
        dueDate: number;
        balance: number;
        last3DueDates?: string | null;
    };
}

export function CardCountdown({ card }: CardCountdownProps) {
    const countdown = useMemo(() => {
        const today = new Date();
        const currentDay = today.getDate();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        // Calculate next statement date (cutoff date)
        let nextStatementDate = new Date(currentYear, currentMonth, card.cutoffDate);
        if (currentDay >= card.cutoffDate) {
            // If cutoff date has passed this month, next statement is next month
            nextStatementDate = new Date(currentYear, currentMonth + 1, card.cutoffDate);
        }

        // Calculate next due date
        let nextDueDate = new Date(currentYear, currentMonth, card.dueDate);
        if (currentDay >= card.dueDate) {
            // If due date has passed this month, next due date is next month
            nextDueDate = new Date(currentYear, currentMonth + 1, card.dueDate);
        }

        // If we have last 3 due dates, try to predict more accurately
        if (card.last3DueDates) {
            try {
                const lastDates = JSON.parse(card.last3DueDates) as string[];
                const validDates = lastDates.filter(d => d).map(d => new Date(d));
                
                if (validDates.length >= 2) {
                    // Calculate average days between due dates
                    const daysBetween = [];
                    for (let i = 1; i < validDates.length; i++) {
                        const diff = (validDates[i].getTime() - validDates[i-1].getTime()) / (1000 * 60 * 60 * 24);
                        daysBetween.push(diff);
                    }
                    const avgDays = daysBetween.reduce((a, b) => a + b, 0) / daysBetween.length;
                    
                    // Predict next due date from last date
                    if (validDates.length > 0) {
                        const lastDate = validDates[validDates.length - 1];
                        const predictedDate = new Date(lastDate);
                        predictedDate.setDate(predictedDate.getDate() + Math.round(avgDays));
                        
                        // Use predicted date if it's in the future and makes sense
                        if (predictedDate > today && predictedDate.getDate() <= 31) {
                            nextDueDate = predictedDate;
                        }
                    }
                }
            } catch {
                // If parsing fails, use default calculation
            }
        }

        // Calculate days until statement and due date
        const daysUntilStatement = Math.ceil((nextStatementDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const daysUntilDue = Math.ceil((nextDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        return {
            daysUntilStatement,
            daysUntilDue,
            nextStatementDate,
            nextDueDate,
            statementDateFormatted: nextStatementDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            dueDateFormatted: nextDueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        };
    }, [card]);

    return (
        <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
                <div className="text-[10px] text-muted-foreground mb-1">Statement Date</div>
                <div className="font-medium">{countdown.statementDateFormatted}</div>
            </div>
            <div>
                <div className="text-[10px] text-muted-foreground mb-1">Due Date</div>
                <div className="font-medium">{countdown.dueDateFormatted}</div>
            </div>
            <div>
                <div className="text-[10px] text-muted-foreground mb-1">Due In</div>
                <div className={`font-semibold ${
                    countdown.daysUntilDue <= 7 
                        ? "text-red-600" 
                        : countdown.daysUntilDue <= 14 
                        ? "text-orange-600" 
                        : "text-green-600"
                }`}>
                    {countdown.daysUntilDue === 0 
                        ? "Today" 
                        : countdown.daysUntilDue === 1 
                        ? "1 day" 
                        : `${countdown.daysUntilDue} days`}
                </div>
            </div>
        </div>
    );
}
