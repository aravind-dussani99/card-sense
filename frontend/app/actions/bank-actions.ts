"use server";

import { apiFetch } from "@/lib/api";

export async function getBanks() {
    try {
        return await apiFetch<any[]>("/api/banks");
    } catch (error) {
        console.error("Failed to fetch banks:", error);
        return [];
    }
}

export async function addBank(name: string, icon?: string, color?: string) {
    try {
        return await apiFetch("/api/banks", {
            method: "POST",
            body: JSON.stringify({ name, icon, color }),
        });
    } catch (error: any) {
        console.error("Failed to add bank:", error);
        return { success: false, error: error.message || "Failed to add bank" };
    }
}

export async function updateBank(id: string, name: string, icon?: string, color?: string) {
    try {
        return await apiFetch(`/api/banks/${id}`, {
            method: "PUT",
            body: JSON.stringify({ name, icon, color }),
        });
    } catch (error: any) {
        console.error("Failed to update bank:", error);
        return { success: false, error: error.message || "Failed to update bank" };
    }
}

export async function deleteBank(id: string) {
    try {
        await apiFetch(`/api/banks/${id}`, { method: "DELETE", skipJson: true });
        return { success: true };
    } catch (error: any) {
        console.error("Failed to delete bank:", error);
        return { success: false, error: error.message || "Failed to delete bank" };
    }
}

export async function getBankConnections(userId?: string) {
    try {
        const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
        return await apiFetch<any[]>(`/api/bank/connections${query}`);
    } catch (error) {
        console.error("Failed to fetch bank connections:", error);
        return [];
    }
}

export async function getBankAccounts() {
    try {
        return await apiFetch<any[]>("/api/bank/accounts");
    } catch (error) {
        console.error("Failed to fetch bank accounts:", error);
        return [];
    }
}

export async function addBankAccount(data: {
    name: string;
    type?: string;
    bankName?: string;
    mask?: string;
    currency?: string;
    balance?: number;
    availableBalance?: number;
    limit?: number;
}) {
    try {
        return await apiFetch("/api/bank/accounts", {
            method: "POST",
            body: JSON.stringify(data),
        });
    } catch (error: any) {
        console.error("Failed to add bank account:", error);
        return { success: false, error: error.message || "Failed to add bank account" };
    }
}

export async function updateBankAccount(
    id: string,
    data: {
        name?: string;
        type?: string;
        currency?: string;
        mask?: string;
        tags?: string;
        balance?: number;
        availableBalance?: number;
        limit?: number;
    }
) {
    try {
        return await apiFetch(`/api/bank/accounts/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
        });
    } catch (error: any) {
        console.error("Failed to update bank account:", error);
        return { success: false, error: error.message || "Failed to update bank account" };
    }
}
