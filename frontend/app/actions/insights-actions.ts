"use server";

import { apiFetch } from "@/lib/api";

export interface Insight {
    type: "tip" | "alert" | "insight";
    title: string;
    message: string;
}

export async function getInsights() {
    try {
        return await apiFetch<Insight[]>("/api/insights");
    } catch (error) {
        console.error("Failed to generate insights:", error);
        return [];
    }
}
