"use server";

import { apiFetch } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { SecureVaultRecord } from "@/lib/types";

export async function getSecureVaultRecords() {
    try {
        return await apiFetch<SecureVaultRecord[]>("/api/secure-vault");
    } catch (error) {
        console.error("Failed to fetch secure vault records:", error);
        return [];
    }
}

export async function addSecureVaultRecord(data: Record<string, unknown>) {
    try {
        const record = await apiFetch<SecureVaultRecord>("/api/secure-vault", {
            method: "POST",
            body: JSON.stringify(data),
        });
        return { success: true, data: record };
    } catch (error) {
        console.error("Failed to add secure vault record:", error);
        return { success: false, error: getErrorMessage(error, "Failed to add secure vault record") };
    }
}

export async function updateSecureVaultRecord(id: string, data: Record<string, unknown>) {
    try {
        const record = await apiFetch<SecureVaultRecord>(`/api/secure-vault/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
        });
        return { success: true, data: record };
    } catch (error) {
        console.error("Failed to update secure vault record:", error);
        return { success: false, error: getErrorMessage(error, "Failed to update secure vault record") };
    }
}

export async function deleteSecureVaultRecord(id: string) {
    try {
        await apiFetch(`/api/secure-vault/${id}`, { method: "DELETE", skipJson: true });
        return { success: true };
    } catch (error) {
        console.error("Failed to delete secure vault record:", error);
        return { success: false, error: getErrorMessage(error, "Failed to delete secure vault record") };
    }
}
