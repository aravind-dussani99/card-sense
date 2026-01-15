import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { promoteDraftsToApproved } from "@/lib/sync-workbench";

export async function POST(req: NextRequest) {
    try {
        const body: unknown = await req.json().catch(() => ({}));
        const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
        const ids = Array.isArray(payload.ids)
            ? payload.ids.filter((val): val is string => typeof val === "string")
            : [];
        const action = typeof payload.action === "string" ? payload.action : "";

        if (!ids.length) {
            return NextResponse.json({ success: false, error: "No ids provided" }, { status: 400 });
        }

        if (action === "delete") {
            const deleted = await prisma.syncedDraftTransaction.deleteMany({
                where: { id: { in: ids } },
            });
            return NextResponse.json({ success: true, removed: deleted.count });
        }

        if (action === "approve") {
            const result = await promoteDraftsToApproved(ids);
            return NextResponse.json({ success: true, ...result });
        }

        return NextResponse.json({ success: false, error: "Unknown bulk action" }, { status: 400 });
    } catch (error: unknown) {
        console.error("sync-workbench bulk error", error);
        const message = error instanceof Error ? error.message : "Bulk action failed";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
