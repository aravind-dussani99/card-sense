"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [email, setEmail] = useState("");
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState("");
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!token) return;
      try {
        await apiFetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
        setStatus("success");
      } catch {
        setStatus("error");
      }
    };
    void run();
  }, [token]);

  return (
    <div className="mx-auto max-w-md py-12">
      <Card>
        <CardHeader>
          <CardTitle>Verify email</CardTitle>
          <CardDescription>Confirm your email to activate your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "idle" && <p>Verifying...</p>}
          {status === "success" && <p className="text-green-600">Email verified. You can sign in now.</p>}
          {status === "error" && <p className="text-red-600">Verification failed or expired.</p>}
          <a href="/login" className="inline-flex">
            <Button>Go to Sign in</Button>
          </a>
          <div className="border-t pt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Didn’t get the email? Enter your address to resend the verification link.
            </p>
            <div className="space-y-2">
              <Label htmlFor="resend-email">Email</Label>
              <Input
                id="resend-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            {resendError ? <p className="text-sm text-red-600">{resendError}</p> : null}
            {resendMessage ? <p className="text-sm text-green-600">{resendMessage}</p> : null}
            <Button
              type="button"
              variant="outline"
              disabled={resendLoading || !email}
              onClick={async () => {
                setResendError("");
                setResendMessage("");
                setResendLoading(true);
                try {
                  await apiFetch("/api/auth/resend-verification", {
                    method: "POST",
                    body: JSON.stringify({ email }),
                  });
                  setResendMessage("Verification link sent. Check your inbox.");
                } catch (err) {
                  setResendError(err instanceof Error ? err.message : "Failed to resend.");
                } finally {
                  setResendLoading(false);
                }
              }}
            >
              {resendLoading ? "Sending..." : "Resend verification"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md py-12">Loading...</div>}>
      <VerifyEmailForm />
    </Suspense>
  );
}
