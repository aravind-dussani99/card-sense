"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getFromEntities() {
    try {
        const entities = await prisma.fromEntity.findMany({
            orderBy: { name: "asc" },
        });
        return entities;
    } catch (error) {
        console.error("Failed to fetch from entities:", error);
        return [];
    }
}

export async function addFromEntity(name: string, type?: string, icon?: string, color?: string) {
    try {
        await prisma.fromEntity.create({
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
        console.error("Failed to add from entity:", error);
        return { success: false, error: "Failed to add from entity" };
    }
}

export async function updateFromEntity(id: string, name: string, type?: string, icon?: string, color?: string) {
    try {
        await prisma.fromEntity.update({
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
        console.error("Failed to update from entity:", error);
        return { success: false, error: "Failed to update from entity" };
    }
}

export async function deleteFromEntity(id: string) {
    try {
        await prisma.fromEntity.delete({
            where: { id },
        });
        revalidatePath("/settings");
        revalidatePath("/reference-data");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete from entity:", error);
        return { success: false, error: "Failed to delete from entity" };
    }
}

