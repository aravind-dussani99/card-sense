"use server";

import { apiFetch } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";

export async function createCardCredential(cardId: string, encryptedPayload: string, label?: string) {
    try {
        return await apiFetch("/api/credentials/cards", {
            method: "POST",
            body: JSON.stringify({ cardId, encryptedPayload, label }),
        });
    } catch (error) {
        console.error("Failed to store card credential:", error);
        return { success: false, error: getErrorMessage(error, "Failed to store card credential") };
    }
}

export async function createBankAccountCredential(bankAccountId: string, encryptedPayload: string, label?: string) {
    try {
        return await apiFetch("/api/credentials/accounts", {
            method: "POST",
            body: JSON.stringify({ bankAccountId, encryptedPayload, label }),
        });
    } catch (error) {
        console.error("Failed to store account credential:", error);
        return { success: false, error: getErrorMessage(error, "Failed to store account credential") };
    }
}
