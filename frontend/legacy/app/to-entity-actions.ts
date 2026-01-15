"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getToEntities() {
    try {
        const entities = await prisma.toEntity.findMany({
            orderBy: { name: "asc" },
        });
        return entities;
    } catch (error) {
        console.error("Failed to fetch to entities:", error);
        return [];
    }
}

export async function addToEntity(name: string, type?: string, icon?: string, color?: string) {
    try {
        await prisma.toEntity.create({
            data: {
                name,
                type: type || "",
                icon: icon || "",
                color: color || "",
            },
        });
        revalidatePath("/settings");
        revalidatePath("/reference-data");
        return { success: true };
    } catch (error) {
        console.error("Failed to add to entity:", error);
        return { success: false, error: "Failed to add to entity" };
    }
}

export async function updateToEntity(id: string, name: string, type?: string, icon?: string, color?: string) {
    try {
        await prisma.toEntity.update({
            where: { id },
            data: {
                name,
                type: type || "",
                icon: icon || "",
                color: color || "",
            },
        });
        revalidatePath("/settings");
        revalidatePath("/reference-data");
        return { success: true };
    } catch (error) {
        console.error("Failed to update to entity:", error);
        return { success: false, error: "Failed to update to entity" };
    }
}

export async function deleteToEntity(id: string) {
    try {
        await prisma.toEntity.delete({
            where: { id },
        });
        revalidatePath("/settings");
        revalidatePath("/reference-data");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete to entity:", error);
        return { success: false, error: "Failed to delete to entity" };
    }
}

