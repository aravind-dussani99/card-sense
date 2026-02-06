"use server";

import { apiFetch } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { UserCard } from "@/lib/types";

export async function getUserCards() {
    try {
        return await apiFetch<UserCard[]>("/api/user-cards");
    } catch (error) {
        console.error("Failed to fetch user cards:", error);
        return [];
    }
}

export async function addUserCard(data: Record<string, unknown>) {
    try {
        const record = await apiFetch<UserCard>("/api/user-cards", {
            method: "POST",
            body: JSON.stringify(data),
        });
        return { success: true, data: record };
    } catch (error) {
        console.error("Failed to add user card:", error);
        return { success: false, error: getErrorMessage(error, "Failed to add user card") };
    }
}

export async function updateUserCard(id: string, data: Record<string, unknown>) {
    try {
        const record = await apiFetch<UserCard>(`/api/user-cards/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
        });
        return { success: true, data: record };
    } catch (error) {
        console.error("Failed to update user card:", error);
        return { success: false, error: getErrorMessage(error, "Failed to update user card") };
    }
}

export async function deleteUserCard(id: string) {
    try {
        await apiFetch(`/api/user-cards/${id}`, { method: "DELETE", skipJson: true });
        return { success: true };
    } catch (error) {
        console.error("Failed to delete user card:", error);
        return { success: false, error: getErrorMessage(error, "Failed to delete user card") };
    }
}
