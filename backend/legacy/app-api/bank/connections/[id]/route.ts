import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id?: string }> };

async function disconnect(id?: string) {
    if (!id) {
        return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
    }
    await prisma.bankConnection.deleteMany({ where: { id } });
    return NextResponse.json({ success: true });
}

export async function POST(_req: NextRequest, ctx: RouteParams) {
    try {
        const { id } = await ctx.params;
        return await disconnect(id);
    } catch (error: any) {
        console.error("Delete connection error:", error);
        return NextResponse.json({ success: false, error: error.message || "Failed to delete connection" }, { status: 500 });
    }
}

export async function DELETE(_req: NextRequest, ctx: RouteParams) {
    try {
        const { id } = await ctx.params;
        return await disconnect(id);
    } catch (error: any) {
        console.error("Delete connection error:", error);
        return NextResponse.json({ success: false, error: error.message || "Failed to delete connection" }, { status: 500 });
    }
}
