import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exchangeCodeForTokens, fetchInfo } from "@/lib/truelayer-client";

// Optional endpoint if you prefer exchanging from frontend-obtained code (Auth Dialog)
export async function POST(req: NextRequest) {
    try {
        const { code, userId, redirectUri } = await req.json();
        if (!code || !userId) {
            return NextResponse.json({ success: false, error: "code and userId are required" }, { status: 400 });
        }

        const redirect = redirectUri || process.env.TRUELAYER_REDIRECT_URI || "http://localhost:3000/api/bank/callback";
        const tokenData = await exchangeCodeForTokens(code, redirect);
        const info = await fetchInfo(tokenData.access_token).catch(() => null);

        const connection = await prisma.bankConnection.create({
            data: {
                userId,
                provider: "truelayer",
                providerAccountId: info?.user_id || crypto.randomUUID(),
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token || null,
                institutionId: info?.provider_id || null,
                status: "active",
            },
        });

        return NextResponse.json({ success: true, connection });
    } catch (error: any) {
        console.error("Bank exchange error:", error);
        return NextResponse.json({ success: false, error: error.message || "Failed to exchange token" }, { status: 500 });
    }
}
