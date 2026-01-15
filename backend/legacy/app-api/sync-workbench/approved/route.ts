import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function normalizeDate(value: string | null, endOfDay = false) {
    if (!value) return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return undefined;
    if (endOfDay) {
        parsed.setHours(23, 59, 59, 999);
    } else {
        parsed.setHours(0, 0, 0, 0);
    }
    return parsed;
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const page = Number(searchParams.get("page") || "1");
        const pageSize = Number(searchParams.get("pageSize") || "30");
        const sourceType = searchParams.get("sourceType") || undefined;
        const sourceId = searchParams.get("sourceId") || undefined;
        const categoryId = searchParams.get("categoryId") || undefined;
        const subCategoryId = searchParams.get("subCategoryId") || undefined;
        const search = searchParams.get("search") || undefined;
        const fromDate = normalizeDate(searchParams.get("from"));
        const toDate = normalizeDate(searchParams.get("to"), true);

        const where: Prisma.SyncedApprovedTransactionWhereInput = {};
        const orFilters: Prisma.SyncedApprovedTransactionWhereInput[] = [];
        if (sourceType) {
            where.sourceType = sourceType;
        }
        if (sourceId) {
            if (sourceType === "account") {
                where.bankAccountId = sourceId;
            } else if (sourceType === "card") {
                where.cardId = sourceId;
            } else {
                orFilters.push({ bankAccountId: sourceId }, { cardId: sourceId });
            }
        }
        if (categoryId) where.categoryId = categoryId;
        if (subCategoryId) where.subCategoryId = subCategoryId;
        if (fromDate || toDate) {
            where.bookingDate = {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
            };
        }
        if (search) {
            orFilters.push(
                { merchantActual: { contains: search } },
                { descriptionVia: { contains: search } },
                { reference: { contains: search } },
                { category: { contains: search } },
                { subCategory: { contains: search } },
            );
        }
        if (orFilters.length) {
            where.OR = orFilters;
        }

        const [total, transactions] = await Promise.all([
            prisma.syncedApprovedTransaction.count({ where }),
            prisma.syncedApprovedTransaction.findMany({
                where,
                orderBy: { bookingDate: "desc" },
                skip: page > 0 ? (page - 1) * pageSize : 0,
                take: pageSize,
                include: {
                    bankAccount: { select: { id: true, name: true, type: true, mask: true } },
                    card: { select: { id: true, name: true, last4: true } },
                    categoryRef: { select: { id: true, name: true } },
                    subCategoryRef: { select: { id: true, name: true, categoryId: true } },
                },
            }),
        ]);

        return NextResponse.json({
            success: true,
            data: transactions,
            meta: {
                total,
                page,
                pageSize,
            },
        });
    } catch (error: unknown) {
        console.error("sync-workbench approved GET error", error);
        const message = error instanceof Error ? error.message : "Failed to load transactions";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
