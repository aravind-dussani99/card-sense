"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface DraftTransactionData {
    emailId?: string;
    cardId?: string;
    bankAccountId?: string;
    providerTxId?: string;
    source?: string; // email | statement | open_banking
    merchant: string;
    amount: number;
    category?: string;
    subCategory?: string;
    description?: string;
    date: Date;
    transactionType?: string;
    emailSubject?: string;
    emailBody?: string;
    originalData?: string;
    needsCardCreation?: boolean;
}

export async function createDraftTransaction(data: DraftTransactionData) {
    try {
        // Build the data object - use relation syntax for cardId
        const createData: any = {
            emailId: data.emailId || null,
            bankAccountId: data.bankAccountId || null,
            providerTxId: data.providerTxId || null,
            source: data.source || "email",
            merchant: data.merchant,
            amount: data.amount,
            category: data.category || null,
            subCategory: data.subCategory || null,
            description: data.description || null,
            date: data.date,
            transactionType: data.transactionType || "expense",
            emailSubject: data.emailSubject || null,
            emailBody: data.emailBody || null,
            originalData: data.originalData || null,
            needsCardCreation: data.needsCardCreation || false,
            status: "pending",
        };

        // Use relation syntax if cardId is provided
        if (data.cardId) {
            createData.card = {
                connect: { id: data.cardId }
            };
        }

        let draft;
        if (data.providerTxId) {
            draft = await prisma.draftTransaction.upsert({
                where: { providerTxId: data.providerTxId },
                update: createData,
                create: createData,
            });
        } else {
            draft = await prisma.draftTransaction.create({
                data: createData,
            });
        }
        revalidatePath("/drafts");
        return { success: true, data: draft };
    } catch (error: any) {
        console.error("Failed to create draft transaction:", error);
        console.error("Data attempted:", JSON.stringify(data, null, 2));
        return { success: false, error: error.message || "Failed to create draft transaction" };
    }
}

export async function getDraftTransactions() {
    try {
        const drafts = await prisma.draftTransaction.findMany({
            include: {
                card: {
                    include: {
                        cardType: true,
                    },
                },
            },
            orderBy: { date: "desc" },
        });
        return drafts;
    } catch (error) {
        console.error("Failed to fetch draft transactions:", error);
        return [];
    }
}

export async function getPendingDraftTransactions(page: number = 1, pageSize: number = 50) {
    try {
        const skip = Math.max(0, (page - 1) * pageSize);
        const [drafts, total] = await Promise.all([
            prisma.draftTransaction.findMany({
                where: { status: "pending" },
                include: {
                    card: { include: { cardType: true } },
                },
                orderBy: { date: "desc" },
                skip,
                take: pageSize,
            }),
            prisma.draftTransaction.count({ where: { status: "pending" } }),
        ]);
        return { drafts, total, page, pageSize };
    } catch (error: any) {
        console.error("Failed to fetch pending draft transactions:", error);
        console.error("Error details:", error?.message, error?.stack);
        return { drafts: [], total: 0, page, pageSize };
    }
}

export async function updateDraftTransaction(
    id: string,
    data: Partial<DraftTransactionData> & { status?: string; modifiedData?: string }
) {
    try {
        const draft = await prisma.draftTransaction.update({
            where: { id },
            data: {
                ...(data.cardId !== undefined && { cardId: data.cardId || null }),
                ...(data.bankAccountId !== undefined && { bankAccountId: data.bankAccountId || null }),
                ...(data.providerTxId !== undefined && { providerTxId: data.providerTxId || null }),
                ...(data.source !== undefined && { source: data.source || null }),
                ...(data.merchant && { merchant: data.merchant }),
                ...(data.amount !== undefined && { amount: data.amount }),
                ...(data.category !== undefined && { category: data.category || null }),
                ...(data.subCategory !== undefined && { subCategory: data.subCategory || null }),
                ...(data.description !== undefined && { description: data.description || null }),
                ...(data.date && { date: data.date }),
                ...(data.transactionType && { transactionType: data.transactionType }),
                ...(data.emailId !== undefined && { emailId: data.emailId || null }),
                ...(data.emailSubject !== undefined && { emailSubject: data.emailSubject || null }),
                ...(data.emailBody !== undefined && { emailBody: data.emailBody || null }),
                ...(data.originalData !== undefined && { originalData: data.originalData || null }),
                ...(data.needsCardCreation !== undefined && { needsCardCreation: data.needsCardCreation }),
                ...(data.status && { status: data.status }),
                ...(data.modifiedData && { modifiedData: data.modifiedData }),
            },
        });
        revalidatePath("/drafts");
        return { success: true, data: draft };
    } catch (error: any) {
        console.error("Failed to update draft transaction:", error);
        return { success: false, error: error.message || "Failed to update draft transaction" };
    }
}

export async function approveDraftTransaction(id: string) {
    try {
        const draft = await prisma.draftTransaction.findUnique({
            where: { id },
        });

        if (!draft) {
            return { success: false, error: "Draft transaction not found" };
        }

        // Create actual transaction
        const transaction = await prisma.transaction.create({
            data: {
                cardId: draft.cardId || null,
                providerTxId: draft.providerTxId || null,
                merchant: draft.merchant,
                amount: draft.amount,
                category: draft.category || "Other",
                subCategory: draft.subCategory || null,
                description: draft.description || null,
                date: draft.date,
                transactionType: draft.transactionType || "expense",
            },
        });

        // Update draft status
        await prisma.draftTransaction.update({
            where: { id },
            data: { status: "approved" },
        });

        revalidatePath("/drafts");
        revalidatePath("/transactions");
        return { success: true, data: transaction };
    } catch (error: any) {
        console.error("Failed to approve draft transaction:", error);
        return { success: false, error: error.message || "Failed to approve draft transaction" };
    }
}

export async function rejectDraftTransaction(id: string) {
    try {
        await prisma.draftTransaction.update({
            where: { id },
            data: { status: "rejected" },
        });
        revalidatePath("/drafts");
        return { success: true };
    } catch (error: any) {
        console.error("Failed to reject draft transaction:", error);
        return { success: false, error: error.message || "Failed to reject draft transaction" };
    }
}

export async function deleteDraftTransaction(id: string) {
    try {
        await prisma.draftTransaction.delete({
            where: { id },
        });
        revalidatePath("/drafts");
        return { success: true };
    } catch (error: any) {
        if (error.code === "P2025") {
            // Already deleted or not found; treat as success
            return { success: true };
        }
        console.error("Failed to delete draft transaction:", error);
        return { success: false, error: error.message || "Failed to delete draft transaction" };
    }
}
