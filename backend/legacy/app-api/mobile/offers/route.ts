import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const offers = await prisma.offer.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
    });
    return NextResponse.json({ offers });
}
