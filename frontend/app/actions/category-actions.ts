"use server";

import { apiFetch } from "@/lib/api";

export async function getCategories() {
    try {
        return await apiFetch<any[]>("/api/categories");
    } catch (error) {
        console.error("Failed to fetch categories:", error);
        return [];
    }
}

export async function addCategory(name: string, icon?: string, color?: string) {
    try {
        return await apiFetch("/api/categories", {
            method: "POST",
            body: JSON.stringify({ name, icon, color }),
        });
    } catch (error: any) {
        console.error("Failed to add category:", error);
        return { success: false, error: error.message || "Failed to add category" };
    }
}

export async function updateCategory(id: string, name: string, icon?: string, color?: string) {
    try {
        return await apiFetch(`/api/categories/${id}`, {
            method: "PUT",
            body: JSON.stringify({ name, icon, color }),
        });
    } catch (error: any) {
        console.error("Failed to update category:", error);
        return { success: false, error: error.message || "Failed to update category" };
    }
}

export async function deleteCategory(id: string) {
    try {
        await apiFetch(`/api/categories/${id}`, { method: "DELETE", skipJson: true });
        return { success: true };
    } catch (error: any) {
        console.error("Failed to delete category:", error);
        return { success: false, error: error.message || "Failed to delete category" };
    }
}

export async function addSubCategory(categoryId: string, name: string) {
    try {
        return await apiFetch(`/api/categories/${categoryId}/subcategories`, {
            method: "POST",
            body: JSON.stringify({ name }),
        });
    } catch (error: any) {
        console.error("Failed to add sub-category:", error);
        return { success: false, error: error.message || "Failed to add sub-category" };
    }
}

export async function updateSubCategory(id: string, name: string) {
    try {
        return await apiFetch(`/api/subcategories/${id}`, {
            method: "PUT",
            body: JSON.stringify({ name }),
        });
    } catch (error: any) {
        console.error("Failed to update sub-category:", error);
        return { success: false, error: error.message || "Failed to update sub-category" };
    }
}

export async function deleteSubCategory(id: string) {
    try {
        await apiFetch(`/api/subcategories/${id}`, { method: "DELETE", skipJson: true });
        return { success: true };
    } catch (error: any) {
        console.error("Failed to delete sub-category:", error);
        return { success: false, error: error.message || "Failed to delete sub-category" };
    }
}
