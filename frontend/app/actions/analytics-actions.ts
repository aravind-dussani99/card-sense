"use server";

import { apiFetch } from "@/lib/api";

export async function getSpendingByCategory() {
    try {
        return await apiFetch<any[]>("/api/analytics/spending-by-category");
    } catch (error) {
        console.error("Failed to fetch spending by category:", error);
        return [];
    }
}

export async function getMonthlySpending() {
    try {
        return await apiFetch<any[]>("/api/analytics/monthly");
    } catch (error) {
        console.error("Failed to fetch monthly spending:", error);
        return [];
    }
}

export async function getSpendingByCard() {
    try {
        return await apiFetch<any[]>("/api/analytics/by-card");
    } catch (error) {
        console.error("Failed to fetch spending by card:", error);
        return [];
    }
}

export async function getSpendingByMerchant() {
    try {
        return await apiFetch<any[]>("/api/analytics/by-merchant");
    } catch (error) {
        console.error("Failed to fetch spending by merchant:", error);
        return [];
    }
}
