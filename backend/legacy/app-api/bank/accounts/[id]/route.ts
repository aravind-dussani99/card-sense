import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const id = params.id;
        if (!id) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
        await prisma.bankAccount.update({
            where: { id },
            data: { status: "deleted" },
        });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Delete bank account error:", error);
        return NextResponse.json({ success: false, error: error.message || "Failed to delete bank account" }, { status: 500 });
    }
}
