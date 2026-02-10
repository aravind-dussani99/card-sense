"use server";

import { apiFetch } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { AccountMeta, Card } from "@/lib/types";
import { revalidatePath } from "next/cache";

const CARD_ACCOUNT_TYPES = new Set(["CREDIT_CARD", "DEBIT_CARD", "CASH_CARD"]);

export interface CardFormData {
    name: string;
    nameOnCard?: string;
    bank: string;
    cardNetwork?: string;
    last4: string;
    fullCardNumber?: string;
    expiryDate?: string;
    cvv?: string;
    statementPassword?: string;
    limit: number;
    balance?: number;
    cutoffDate: number;
    dueDate: number;
    last3DueDates?: string;
    color: string;
}

export async function addCard(data: CardFormData) {
    try {
        const card = await apiFetch<AccountMeta>("/api/account-meta", {
            method: "POST",
            body: JSON.stringify({
                label: data.name,
                accountType: "CREDIT_CARD",
                accountHolderName: data.nameOnCard || undefined,
                bankName: data.bank,
                cardLast4: data.last4,
                cardNetwork: data.cardNetwork || undefined,
                balance: data.balance ?? 0,
                limit: data.limit ?? 0,
                statementDay: data.cutoffDate,
                dueDay: data.dueDate,
                status: "active",
            }),
        });
        revalidatePath("/cards");
        return { success: true, data: mapAccountMetaToCard(card) };
    } catch (error) {
        console.error("Failed to add card:", error);
        return { success: false, error: getErrorMessage(error, "Failed to add card") };
    }
}

export async function updateCard(id: string, data: Partial<CardFormData>) {
    try {
        const card = await apiFetch<AccountMeta>(`/api/account-meta/${id}`, {
            method: "PUT",
            body: JSON.stringify({
                label: data.name,
                accountHolderName: data.nameOnCard,
                bankName: data.bank,
                cardLast4: data.last4,
                cardNetwork: data.cardNetwork,
                balance: data.balance,
                limit: data.limit,
                statementDay: data.cutoffDate,
                dueDay: data.dueDate,
            }),
        });
        revalidatePath("/cards");
        return { success: true, data: mapAccountMetaToCard(card) };
    } catch (error) {
        console.error("Failed to update card:", error);
        return { success: false, error: getErrorMessage(error, "Failed to update card") };
    }
}

export async function deleteCard(id: string) {
    try {
        await apiFetch(`/api/account-meta/${id}`, { method: "DELETE", skipJson: true });
        revalidatePath("/cards");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete card:", error);
        return { success: false, error: getErrorMessage(error, "Failed to delete card") };
    }
}

export async function getCards() {
    try {
        const records = await apiFetch<AccountMeta[]>("/api/account-meta");
        return records
            .filter((record) => CARD_ACCOUNT_TYPES.has(record.accountType))
            .map(mapAccountMetaToCard);
    } catch (error) {
        console.error("Failed to fetch cards:", error);
        return [];
    }
}

export async function getSuggestedCardsAndAccounts() {
    return [];
}

const mapAccountMetaToCard = (record: AccountMeta): Card => ({
    id: record.id,
    name: record.label,
    last4: record.cardLast4 || null,
    bank: record.bankName || null,
    balance: record.balance ?? null,
    limit: record.limit ?? null,
    cutoffDate: record.statementDay ?? null,
    dueDate: record.dueDay ?? null,
    color: "bg-gray-800",
});
