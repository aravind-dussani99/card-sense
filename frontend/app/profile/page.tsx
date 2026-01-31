"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { clearAuthToken } from "@/lib/auth-client";
import { MainNav } from "@/components/main-nav";
import { AuthMenu } from "@/components/auth-menu";
import Link from "next/link";

type MeResponse = {
  user: { id: string; email: string; name?: string | null; emailVerifiedAt?: string | null };
};

export default function ProfilePage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const result = await apiFetch<MeResponse>("/api/auth/me");
        setEmail(result.user.email);
        setName(result.user.name || "");
        setVerifiedAt(result.user.emailVerifiedAt || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile");
      }
    };
    void load();
  }, []);

  const handleSave = async () => {
    setError("");
    setMessage("");
    try {
      await apiFetch("/api/auth/profile", {
        method: "PUT",
        body: JSON.stringify({ name }),
      });
      setMessage("Profile updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    }
  };

  const handleLogout = () => {
    clearAuthToken();
    window.location.href = "/login";
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
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

      <div className="mx-auto w-full max-w-5xl px-6 py-10 flex-1 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Profile</h1>
          <p className="text-sm text-slate-600">
            Manage your personal details and jump to key settings.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Personal details</CardTitle>
              <CardDescription>Update your name and review account status.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={email} disabled />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="text-sm text-muted-foreground">
                Email status:{" "}
                <span className={verifiedAt ? "text-green-600" : "text-amber-600"}>
                  {verifiedAt ? "Verified" : "Not verified"}
                </span>
              </div>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              {message ? <p className="text-sm text-green-600">{message}</p> : null}
              <div className="flex gap-3">
                <Button onClick={handleSave}>Save</Button>
                <Button variant="outline" onClick={handleLogout}>Sign out</Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Account shortcuts</CardTitle>
                <CardDescription>Quick actions to manage your data.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Link href="/settings">
                  <Button variant="outline" className="w-full justify-between">
                    Open Settings
                    <span className="text-xs text-muted-foreground">Connections & passphrase</span>
                  </Button>
                </Link>
                <Link href="/vault">
                  <Button variant="outline" className="w-full justify-between">
                    Secure Vault
                    <span className="text-xs text-muted-foreground">Local-only encryption</span>
                  </Button>
                </Link>
                <Link href="/reference-data">
                  <Button variant="outline" className="w-full justify-between">
                    Reference Data
                    <span className="text-xs text-muted-foreground">Categories & banks</span>
                  </Button>
                </Link>
                <Link href="/feedback">
                  <Button variant="outline" className="w-full justify-between">
                    Send Feedback
                    <span className="text-xs text-muted-foreground">Ideas or issues</span>
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Security</CardTitle>
                <CardDescription>Reset your password if needed.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Link href="/forgot-password">
                  <Button variant="outline" className="w-full">Reset password</Button>
                </Link>
                {!verifiedAt ? (
                  <Link href="/verify-email">
                    <Button variant="outline" className="w-full">Resend verification</Button>
                  </Link>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
