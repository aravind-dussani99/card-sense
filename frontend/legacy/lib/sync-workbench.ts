import { prisma } from "@/lib/prisma";

export type SyncSource = {
    type: "account" | "card";
    id: string;
};

export function buildDedupeKey(source: SyncSource, providerId: string) {
    const normalizedProvider = providerId || "unknown";
    return `${source.type}:${source.id}:${normalizedProvider}`;
}

export async function promoteDraftsToApproved(ids: string[]) {
    if (!ids.length) {
        return { created: 0, removed: 0 };
    }

    return prisma.$transaction(async (tx) => {
        const drafts = await tx.syncedDraftTransaction.findMany({
            where: { id: { in: ids } },
        });
        if (!drafts.length) {
            return { created: 0, removed: 0 };
        }

        for (const draft of drafts) {
            await tx.syncedApprovedTransaction.create({
                data: {
                    sourceDraftId: draft.id,
                    sourceType: draft.sourceType,
                    bankAccountId: draft.bankAccountId,
                    cardId: draft.cardId,
                    dedupeKey: draft.dedupeKey,
                    providerTransactionId: draft.providerTransactionId,
                    reference: draft.reference,
                    transactionType: draft.transactionType,
                    direction: draft.direction,
                    amount: draft.amount,
                    currency: draft.currency,
                    description: draft.description,
                    merchantName: draft.merchantName,
                    merchantCategoryCode: draft.merchantCategoryCode,
                    categoryId: draft.categoryId,
                    category: draft.category,
                    subCategoryId: draft.subCategoryId,
                    subCategory: draft.subCategory,
                    bookingDate: draft.bookingDate,
                    valueDate: draft.valueDate,
                    runningBalance: draft.runningBalance,
                    rawData: draft.rawData,
                    notes: draft.notes,
                },
            });
            await tx.syncedDraftTransaction.delete({ where: { id: draft.id } });
        }

        return { created: drafts.length, removed: drafts.length };
    });
}
