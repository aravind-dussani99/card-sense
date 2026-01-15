import { NextResponse } from "next/server";
import { promoteDraftsToApproved } from "@/lib/sync-workbench";

type RouteParams = {
    params: { id: string };
};

export async function POST(_req: Request, { params }: RouteParams) {
    try {
        const { created } = await promoteDraftsToApproved([params.id]);
        if (!created) {
            return NextResponse.json({ success: false, error: "Draft not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true, created });
    } catch (error: unknown) {
        console.error("sync-workbench approve error", error);
        const message = error instanceof Error ? error.message : "Failed to approve draft";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
