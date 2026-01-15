import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { answerQuestion } from "@/lib/chat-qa";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get("chatId");
    if (!chatId) return NextResponse.json({ messages: [] });
    const messages = await prisma.chatMessage.findMany({
        where: { chatId },
        orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
    const { chatId, content } = await req.json();
    if (!chatId || !content) {
        return NextResponse.json({ error: "chatId and content required" }, { status: 400 });
    }

    await prisma.chatMessage.create({
        data: { chatId, role: "user", content },
    });

    const answer = await answerQuestion(content);
    const assistant = await prisma.chatMessage.create({
        data: { chatId, role: "assistant", content: answer },
    });

    return NextResponse.json({ message: assistant });
}
