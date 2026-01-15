import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const drafts = await prisma.syncedDraftTransaction.findMany({
            select: {
                id: true,
                sourceType: true,
                bankAccountId: true,
                cardId: true,
                bankAccount: { select: { id: true, name: true, type: true, mask: true } },
                card: { select: { id: true, name: true, last4: true } },
            },
        });

        const map = new Map<string, any>();
        drafts.forEach((d) => {
            const key =
                d.sourceType === "account"
                    ? `account:${d.bankAccountId || "unknown"}`
                    : `card:${d.cardId || "unknown"}`;
            if (!map.has(key)) {
                map.set(key, {
                    value: key,
                    sourceType: d.sourceType,
                    bankAccountId: d.bankAccountId,
                    cardId: d.cardId,
                    bankAccount: d.bankAccount,
                    card: d.card,
                });
            }
        });

        return NextResponse.json({ success: true, data: Array.from(map.values()) });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to load sources";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
