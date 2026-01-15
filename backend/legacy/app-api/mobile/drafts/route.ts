import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const source = searchParams.get("source") || undefined;
    const accountId = searchParams.get("accountId") || undefined;

    const drafts = await prisma.draftTransaction.findMany({
        where: {
            status: "pending",
            ...(source ? { source } : {}),
            ...(accountId ? { bankAccountId: accountId } : {}),
        },
        orderBy: { date: "desc" },
    });
    return NextResponse.json({ drafts });
}
