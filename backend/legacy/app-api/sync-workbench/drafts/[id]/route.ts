import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type RouteParams = {
    params: Promise<{ id: string }>;
};

export async function PATCH(req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const rawBody: unknown = await req.json().catch(() => ({}));
        const body = rawBody && typeof rawBody === "object" ? (rawBody as Record<string, unknown>) : {};

        const data: Prisma.BankTransactionUpdateInput = {};
        if (typeof body.merchantTo === "string") data.merchant = body.merchantTo;
        if (typeof body.merchant === "string") data.merchant = body.merchant;
        if (body.amount !== undefined && body.amount !== null && !Number.isNaN(Number(body.amount))) {
            data.amount = Number(body.amount);
        }
        if (typeof body.category === "string") data.category = body.category;
        if (typeof body.descriptionVia === "string") data.descriptionVia = body.descriptionVia;
        if (typeof body.description === "string") data.descriptionVia = body.description;
        if (typeof body.direction === "string") data.direction = body.direction;
        if (typeof body.raw === "string") data.raw = body.raw;
        if (body.date !== undefined) {
            const bookingInput = typeof body.date === "string" ? body.date : undefined;
            const dateVal = bookingInput ? new Date(bookingInput) : null;
            if (Number.isNaN(dateVal?.getTime() || NaN)) {
                return NextResponse.json({ success: false, error: "Invalid date" }, { status: 400 });
            }
            if (dateVal) data.date = dateVal;
        }

        if (!Object.keys(data).length) {
            return NextResponse.json({ success: false, error: "No fields to update" }, { status: 400 });
        }

        const updated = await prisma.bankTransaction.update({
            where: { id },
            data,
        });

        return NextResponse.json({ success: true, data: updated });
    } catch (error: unknown) {
        console.error("bank transaction PATCH error", error);
        const message = error instanceof Error ? error.message : "Failed to update transaction";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        await prisma.bankTransaction.delete({
            where: { id },
        });
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("bank transaction DELETE error", error);
        const message = error instanceof Error ? error.message : "Failed to delete transaction";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
