import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const page = Number(searchParams.get("page") || "1");
        const pageSize = Number(searchParams.get("pageSize") || "15");
        const search = searchParams.get("search") || undefined;
        const accountId = searchParams.get("accountId") || undefined;
        const category = searchParams.get("categoryId") || undefined;
        const fromDate = searchParams.get("fromDate") || undefined;
        const toDate = searchParams.get("toDate") || undefined;

        const where: Prisma.BankTransactionWhereInput = {};
        const orFilters: Prisma.BankTransactionWhereInput[] = [];
        if (search) {
            orFilters.push(
                { merchant: { contains: search } },
                { descriptionVia: { contains: search } },
                { category: { contains: search } },
            );
        }
        if (accountId) {
            where.accountId = accountId;
        }
        if (category) {
            where.category = category;
        }
        if (fromDate || toDate) {
            where.date = {
                ...(fromDate ? { gte: new Date(fromDate) } : {}),
                ...(toDate ? { lte: new Date(toDate) } : {}),
            };
        }
        if (orFilters.length) {
            where.OR = orFilters;
        }

        const [total, drafts] = await Promise.all([
            prisma.bankTransaction.count({ where }),
            prisma.bankTransaction.findMany({
                where,
                orderBy: { date: "desc" },
                skip: page > 0 ? (page - 1) * pageSize : 0,
                take: pageSize,
                include: { account: true },
            }),
        ]);

        return NextResponse.json({
            success: true,
            data: drafts,
            meta: {
                total,
                page,
                pageSize,
            },
        });
    } catch (error: unknown) {
        console.error("sync-workbench drafts GET error", error);
        const message = error instanceof Error ? error.message : "Failed to load drafts";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const rawBody: unknown = await req.json().catch(() => ({}));
        const body = rawBody && typeof rawBody === "object" ? (rawBody as Record<string, unknown>) : {};
        const amount = typeof body.amount === "number" ? body.amount : Number(body.amount || 0);
        const bookingDate = body.bookingDate ? new Date(String(body.bookingDate)) : new Date();

        const created = await prisma.bankTransaction.create({
            data: {
                id: `manual-${Date.now()}`,
                accountId: typeof body.accountId === "string" ? body.accountId : "",
                providerTransactionId: typeof body.providerTransactionId === "string" ? body.providerTransactionId : `manual-${Date.now()}`,
                merchant: typeof body.merchantTo === "string" ? body.merchantTo : typeof body.merchantName === "string" ? body.merchantName : null,
                descriptionVia: typeof body.descriptionVia === "string"
                    ? body.descriptionVia
                    : typeof body.description === "string"
                        ? body.description
                        : typeof body.merchantName === "string"
                            ? body.merchantName
                            : null,
                category: typeof body.category === "string" ? body.category : null,
                currency: typeof body.currency === "string" ? body.currency : "USD",
                amount,
                direction: typeof body.direction === "string" ? body.direction : amount < 0 ? "debit" : "credit",
                date: bookingDate,
                pending: false,
                raw: typeof body.raw === "string" ? body.raw : null,
            },
        });

        return NextResponse.json({ success: true, data: created });
    } catch (error: unknown) {
        console.error("sync-workbench drafts POST error", error);
        const message = error instanceof Error ? error.message : "Failed to create transaction";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
