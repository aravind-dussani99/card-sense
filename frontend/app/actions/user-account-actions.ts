"use server";

import { apiFetch } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { UserAccount } from "@/lib/types";

export async function getUserAccounts() {
    try {
        return await apiFetch<UserAccount[]>("/api/user-accounts");
    } catch (error) {
        console.error("Failed to fetch user accounts:", error);
        return [];
    }
}

export async function addUserAccount(data: Record<string, unknown>) {
    try {
        const record = await apiFetch<UserAccount>("/api/user-accounts", {
            method: "POST",
            body: JSON.stringify(data),
        });
        return { success: true, data: record };
    } catch (error) {
        console.error("Failed to add user account:", error);
        return { success: false, error: getErrorMessage(error, "Failed to add user account") };
    }
}

export async function updateUserAccount(id: string, data: Record<string, unknown>) {
    try {
        const record = await apiFetch<UserAccount>(`/api/user-accounts/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
        });
        return { success: true, data: record };
    } catch (error) {
        console.error("Failed to update user account:", error);
        return { success: false, error: getErrorMessage(error, "Failed to update user account") };
    }
}

export async function deleteUserAccount(id: string) {
    try {
        await apiFetch(`/api/user-accounts/${id}`, { method: "DELETE", skipJson: true });
        return { success: true };
    } catch (error) {
        console.error("Failed to delete user account:", error);
        return { success: false, error: getErrorMessage(error, "Failed to delete user account") };
    }
}
