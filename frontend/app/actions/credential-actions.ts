"use server";

import { apiFetch } from "@/lib/api";

export async function createCardCredential(cardId: string, encryptedPayload: string, label?: string) {
    try {
        return await apiFetch("/api/credentials/cards", {
            method: "POST",
            body: JSON.stringify({ cardId, encryptedPayload, label }),
        });
    } catch (error: any) {
        console.error("Failed to store card credential:", error);
        return { success: false, error: error.message || "Failed to store card credential" };
    }
}

export async function createBankAccountCredential(bankAccountId: string, encryptedPayload: string, label?: string) {
    try {
        return await apiFetch("/api/credentials/accounts", {
            method: "POST",
            body: JSON.stringify({ bankAccountId, encryptedPayload, label }),
        });
    } catch (error: any) {
        console.error("Failed to store account credential:", error);
        return { success: false, error: error.message || "Failed to store account credential" };
    }
}
