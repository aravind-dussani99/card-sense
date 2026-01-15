"use server";

import { apiFetch } from "@/lib/api";
import { revalidatePath } from "next/cache";

export interface CardFormData {
    name: string;
    nameOnCard?: string;
    bank: string;
    bankId?: string;
    cardTypeId?: string;
    cardCategory?: string;
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
        const card = await apiFetch("/api/cards", {
            method: "POST",
            body: JSON.stringify(data),
        });
        revalidatePath("/cards");
        return { success: true, data: card };
    } catch (error: any) {
        console.error("Failed to add card:", error);
        return { success: false, error: error.message || "Failed to add card" };
    }
}

export async function updateCard(id: string, data: Partial<CardFormData>) {
    try {
        const card = await apiFetch(`/api/cards/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
        });
        revalidatePath("/cards");
        return { success: true, data: card };
    } catch (error: any) {
        console.error("Failed to update card:", error);
        return { success: false, error: error.message || "Failed to update card" };
    }
}

export async function deleteCard(id: string) {
    try {
        await apiFetch(`/api/cards/${id}`, { method: "DELETE", skipJson: true });
        revalidatePath("/cards");
        return { success: true };
    } catch (error: any) {
        console.error("Failed to delete card:", error);
        return { success: false, error: error.message || "Failed to delete card" };
    }
}

export async function getCards() {
    try {
        return await apiFetch<any[]>("/api/cards");
    } catch (error) {
        console.error("Failed to fetch cards:", error);
        return [];
    }
}

export async function getSuggestedCardsAndAccounts() {
    return [];
}
