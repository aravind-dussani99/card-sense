"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { MainNav } from "@/components/main-nav";
import { AuthMenu } from "@/components/auth-menu";

type MeResponse = {
  user: { email: string; name?: string | null };
};

export default function FeedbackPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    const load = async () => {
      try {
        const result = await apiFetch<MeResponse>("/api/auth/me");
        setName(result.user.name || "");
        setEmail(result.user.email || "");
      } catch {
        // ignore if not signed in
      }
    };
    void load();
  }, []);

  useEffect(() => {
    const prefill = searchParams.get("prefill");
    if (prefill && !message) {
      setMessage(prefill);
    }
  }, [message, searchParams]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("idle");
    setError("");
    setLoading(true);
    try {
      await apiFetch("/api/feedback", {
        method: "POST",
        body: JSON.stringify({ name, email, message }),
      });
      setStatus("success");
      setMessage("");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to send feedback");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="border-b bg-white/80 backdrop-blur-md shadow-sm">
        <div className="flex h-16 items-center px-4">
          <h1 className="text-xl font-bold mr-8 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            CardSense
          </h1>
          <MainNav className="mx-6" />
          <div className="ml-auto flex items-center gap-3">
            <AuthMenu />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-xl py-12 px-6">
        <Card>
          <CardHeader>
            <CardTitle>Share feedback</CardTitle>
            <CardDescription>
              Send ideas, bugs, or feature requests. You can submit anonymously.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name (optional)</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email (optional)</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Feedback</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what you think..."
                  rows={5}
                  required
                />
              </div>
              {status === "success" && (
                <p className="text-sm text-green-600">Thanks! Your feedback was sent.</p>
              )}
              {status === "error" && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={loading}>
                {loading ? "Sending..." : "Send feedback"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
