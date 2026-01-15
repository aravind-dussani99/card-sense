"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Session {
    id: string;
    title: string;
    createdAt: string;
}
interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: string;
}

export default function ChatUI() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [activeSession, setActiveSession] = useState<string | null>(null);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);

    const loadSessions = async () => {
        const res = await fetch("/api/chat/sessions");
        const data = await res.json();
        setSessions(data.sessions || []);
        if (!activeSession && data.sessions?.[0]) {
            setActiveSession(data.sessions[0].id);
        }
    };

    const loadMessages = async (chatId: string) => {
        const res = await fetch(`/api/chat/messages?chatId=${chatId}`);
        const data = await res.json();
        setMessages(data.messages || []);
    };

    useEffect(() => {
        loadSessions();
    }, []);

    useEffect(() => {
        if (activeSession) loadMessages(activeSession);
    }, [activeSession]);

    const handleSend = async () => {
        if (!activeSession || !input.trim()) return;
        setLoading(true);
        const content = input.trim();
        setMessages((prev) => [
            ...prev,
            { id: `temp-${Date.now()}`, role: "user", content, createdAt: new Date().toISOString() },
        ]);
        setInput("");
        const res = await fetch("/api/chat/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chatId: activeSession, content }),
        });
        const data = await res.json();
        if (data.message) {
            setMessages((prev) => [...prev, data.message]);
        }
        setLoading(false);
    };

    const handleNewChat = async () => {
        const res = await fetch("/api/chat/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "New chat" }),
        });
        const data = await res.json();
        if (data.session) {
            setSessions((prev) => [data.session, ...prev]);
            setActiveSession(data.session.id);
            setMessages([]);
        }
    };

    return (
        <div className="flex h-[calc(100vh-80px)]">
            <aside className="w-64 border-r p-4 flex flex-col gap-3 overflow-y-auto">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-sm">Chats</h2>
                    <Button size="sm" onClick={handleNewChat}>+ New</Button>
                </div>
                <div className="flex flex-col gap-2">
                    {sessions.map((s) => (
                        <button
                            key={s.id}
                            className={cn(
                                "text-left p-2 rounded-md border hover:bg-gray-50",
                                activeSession === s.id ? "border-primary bg-gray-50" : "border-gray-200"
                            )}
                            onClick={() => setActiveSession(s.id)}
                        >
                            <div className="font-medium text-sm truncate">{s.title}</div>
                            <div className="text-xs text-muted-foreground">
                                {new Date(s.createdAt).toLocaleDateString()}
                            </div>
                        </button>
                    ))}
                </div>
            </aside>
            <main className="flex-1 flex flex-col">
                <Card className="flex-1 m-4 flex flex-col">
                    <CardHeader>
                        <CardTitle>Ask about your data</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col gap-3">
                        <div className="flex-1 overflow-y-auto border rounded-md p-4 space-y-3">
                            {messages.map((m) => (
                                <div key={m.id} className={cn("max-w-3xl", m.role === "assistant" ? "" : "ml-auto")}>
                                    <div className={cn(
                                        "rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                                        m.role === "assistant" ? "bg-gray-100" : "bg-primary text-primary-foreground"
                                    )}>
                                        {m.content}
                                    </div>
                                </div>
                            ))}
                            {messages.length === 0 && (
                                <div className="text-sm text-muted-foreground">Ask questions like “How many cards?”, “Total balances?”, “How much do I owe to Alex?”</div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Type your question..."
                                className="flex-1"
                                rows={2}
                            />
                            <Button onClick={handleSend} disabled={!input.trim() || loading}>
                                Send
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
