"use server";

import { apiFetch } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { ApiResponse, BankTransaction } from "@/lib/types";
import { revalidatePath } from "next/cache";

export interface TransactionFormData {
    cardId?: string;
    merchant: string;
    amount: number;
    category: string;
    subCategory?: string;
    description?: string;
    date?: Date;
    transactionType?: "expense" | "loan_given" | "loan_received";
    loanTo?: string;
    loanFrom?: string;
}

export async function addTransaction(data: TransactionFormData) {
    try {
        await apiFetch("/api/transactions", {
            method: "POST",
            body: JSON.stringify(data),
        });
        revalidatePath("/");
        revalidatePath("/cards");
        return { success: true };
    } catch (error) {
        console.error("Failed to add transaction:", error);
        return { success: false, error: "Failed to add transaction" };
    }
}

export async function getTransactions(filters?: {
    cardId?: string;
    category?: string;
    transactionType?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
}) {
    try {
        const params = new URLSearchParams();
        if (filters?.cardId) params.set("cardId", filters.cardId);
        if (filters?.category) params.set("category", filters.category);
        if (filters?.transactionType) params.set("transactionType", filters.transactionType);
        if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom.toISOString());
        if (filters?.dateTo) params.set("dateTo", filters.dateTo.toISOString());
        if (filters?.limit) params.set("limit", String(filters.limit));
        const query = params.toString();
        return await apiFetch<Record<string, unknown>[]>(`/api/transactions${query ? `?${query}` : ""}`);
    } catch (error) {
        console.error("Failed to fetch transactions:", error);
        return [];
    }
}

export async function getBankTransactions(limit = 100) {
    try {
        const params = new URLSearchParams({
            page: "1",
            pageSize: String(limit),
        });
        const response = await apiFetch<ApiResponse<BankTransaction[]>>(
            `/api/transactions/drafts?${params.toString()}`
        );
        if (!response?.success) {
            return [];
        }
        return response.data || [];
    } catch (error) {
        console.error("Failed to fetch bank transactions:", error);
        return [];
    }
}

export async function getTransaction(id: string) {
    try {
        return await apiFetch<Record<string, unknown>>(`/api/transactions/${id}`);
    } catch (error) {
        console.error("Failed to fetch transaction:", error);
        return null;
    }
}

export async function updateTransaction(id: string, data: TransactionFormData) {
    try {
        await apiFetch(`/api/transactions/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
        });
        revalidatePath("/");
        revalidatePath("/cards");
        return { success: true };
    } catch (error) {
        console.error("Failed to update transaction:", error);
        return { success: false, error: getErrorMessage(error, "Failed to update transaction") };
    }
}

export async function deleteTransaction(id: string) {
    try {
        await apiFetch(`/api/transactions/${id}`, { method: "DELETE", skipJson: true });
        revalidatePath("/");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete transaction:", error);
        return { success: false, error: getErrorMessage(error, "Failed to delete transaction") };
    }
}
