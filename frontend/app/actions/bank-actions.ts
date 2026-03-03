"use server";

import { apiFetch } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { ApiResponse, BankAccount, BankConnection } from "@/lib/types";

export async function getBankConnections(userId?: string) {
    try {
        const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
        const connections = await apiFetch<BankConnection[]>(`/api/bank/connections${query}`);
        const now = Date.now();
        return connections.map((connection) => {
            const createdAt = connection.createdAt ? new Date(connection.createdAt).getTime() : now;
            const days = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
            const daysLeft = Math.max(0, 90 - days);
            return { ...connection, daysLeft };
        });
    } catch (error) {
        console.error("Failed to fetch bank connections:", error);
        return [];
    }
}

export async function getBankAccounts() {
    try {
        return await apiFetch<BankAccount[]>("/api/bank/accounts");
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
    accountNumber?: string;
    sortCode?: string;
    currency?: string;
    balance?: number;
    availableBalance?: number;
    limit?: number;
    statementBalance?: number;
    statementDate?: string;
    statementDueDate?: string;
    statementPaidAmount?: number;
}) {
    try {
        return await apiFetch<ApiResponse<BankAccount>>("/api/bank/accounts", {
            method: "POST",
            body: JSON.stringify(data),
        });
    } catch (error) {
        console.error("Failed to add bank account:", error);
        return { success: false, error: getErrorMessage(error, "Failed to add bank account") };
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
        accountNumber?: string;
        sortCode?: string;
        balance?: number;
        availableBalance?: number;
        limit?: number;
        statementBalance?: number;
        statementDate?: string;
        statementDueDate?: string;
        statementPaidAmount?: number;
    }
) {
    try {
        return await apiFetch<ApiResponse<BankAccount>>(`/api/bank/accounts/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
        });
    } catch (error) {
        console.error("Failed to update bank account:", error);
        return { success: false, error: getErrorMessage(error, "Failed to update bank account") };
    }
}
