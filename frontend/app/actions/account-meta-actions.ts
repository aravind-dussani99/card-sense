"use server";

import { apiFetch } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { AccountMeta } from "@/lib/types";

export async function getAccountMetas(params?: Record<string, string>) {
    try {
        const query = params ? new URLSearchParams(params).toString() : "";
        return await apiFetch<AccountMeta[]>(`/api/account-meta${query ? `?${query}` : ""}`);
    } catch (error) {
        console.error("Failed to fetch account metadata:", error);
        return [];
    }
}

export async function addAccountMeta(data: Record<string, unknown>) {
    try {
        const record = await apiFetch<AccountMeta>("/api/account-meta", {
            method: "POST",
            body: JSON.stringify(data),
        });
        return { success: true, data: record };
    } catch (error) {
        console.error("Failed to add account metadata:", error);
        return { success: false, error: getErrorMessage(error, "Failed to add account metadata") };
    }
}

export async function updateAccountMeta(id: string, data: Record<string, unknown>) {
    try {
        const record = await apiFetch<AccountMeta>(`/api/account-meta/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
        });
        return { success: true, data: record };
    } catch (error) {
        console.error("Failed to update account metadata:", error);
        return { success: false, error: getErrorMessage(error, "Failed to update account metadata") };
    }
}

export async function deleteAccountMeta(id: string) {
    try {
        await apiFetch(`/api/account-meta/${id}`, { method: "DELETE", skipJson: true });
        return { success: true };
    } catch (error) {
        console.error("Failed to delete account metadata:", error);
        return { success: false, error: getErrorMessage(error, "Failed to delete account metadata") };
    }
}
