"use server";

import { apiFetch } from "@/lib/api";

export async function getCardTypes() {
    try {
        return await apiFetch<any[]>("/api/card-types");
    } catch (error) {
        console.error("Failed to fetch card types:", error);
        return [];
    }
}

export async function addCardType(name: string, icon?: string, color?: string) {
    try {
        return await apiFetch("/api/card-types", {
            method: "POST",
            body: JSON.stringify({ name, icon, color }),
        });
    } catch (error: any) {
        console.error("Failed to add card type:", error);
        return { success: false, error: error.message || "Failed to add card type" };
    }
}

export async function updateCardType(id: string, name: string, icon?: string, color?: string) {
    try {
        return await apiFetch(`/api/card-types/${id}`, {
            method: "PUT",
            body: JSON.stringify({ name, icon, color }),
        });
    } catch (error: any) {
        console.error("Failed to update card type:", error);
        return { success: false, error: error.message || "Failed to update card type" };
    }
}

export async function deleteCardType(id: string) {
    try {
        await apiFetch(`/api/card-types/${id}`, { method: "DELETE", skipJson: true });
        return { success: true };
    } catch (error: any) {
        console.error("Failed to delete card type:", error);
        return { success: false, error: error.message || "Failed to delete card type" };
    }
}
