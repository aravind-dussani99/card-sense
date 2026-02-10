"use server";

import { apiFetch } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { SensitiveInfo } from "@/lib/types";

export async function getSensitiveInfo(accountMetaId: string, includePayload = false) {
    try {
        const params = new URLSearchParams({ accountMetaId });
        if (includePayload) params.set("includePayload", "true");
        return await apiFetch<SensitiveInfo[]>(`/api/sensitive-info?${params.toString()}`);
    } catch (error) {
        console.error("Failed to fetch sensitive info:", error);
        return [];
    }
}

export async function addSensitiveInfo(data: Record<string, unknown>) {
    try {
        const record = await apiFetch<SensitiveInfo>("/api/sensitive-info", {
            method: "POST",
            body: JSON.stringify(data),
        });
        return { success: true, data: record };
    } catch (error) {
        console.error("Failed to add sensitive info:", error);
        return { success: false, error: getErrorMessage(error, "Failed to add sensitive info") };
    }
}

export async function updateSensitiveInfo(id: string, data: Record<string, unknown>) {
    try {
        const record = await apiFetch<SensitiveInfo>(`/api/sensitive-info/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
        });
        return { success: true, data: record };
    } catch (error) {
        console.error("Failed to update sensitive info:", error);
        return { success: false, error: getErrorMessage(error, "Failed to update sensitive info") };
    }
}

export async function deleteSensitiveInfo(id: string) {
    try {
        await apiFetch(`/api/sensitive-info/${id}`, { method: "DELETE", skipJson: true });
        return { success: true };
    } catch (error) {
        console.error("Failed to delete sensitive info:", error);
        return { success: false, error: getErrorMessage(error, "Failed to delete sensitive info") };
    }
}
