import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const sessions = await prisma.chatSession.findMany({
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, createdAt: true },
    });
    return NextResponse.json({ sessions });
}

export async function POST(req: NextRequest) {
    const { title } = await req.json();
    const session = await prisma.chatSession.create({
        data: { title: title || "New chat" },
    });
    return NextResponse.json({ session });
}
