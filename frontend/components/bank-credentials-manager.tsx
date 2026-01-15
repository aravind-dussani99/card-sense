"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiFetch } from "@/lib/api";
import { encryptPayload, decryptPayload } from "@/lib/vault";

type BankAccount = {
  id: string;
  name?: string | null;
  type?: string | null;
  mask?: string | null;
  providerAccountId?: string | null;
};

type CredentialMeta = {
  id: string;
  bankAccountId: string;
  label?: string | null;
};

export function BankCredentialsManager() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [credentials, setCredentials] = useState<CredentialMeta[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [activeAccount, setActiveAccount] = useState<BankAccount | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [label, setLabel] = useState("");
  const [form, setForm] = useState({
    username: "",
    customerName: "",
    password: "",
    passphrase: "",
    memorableInfo: "",
    authDetails: "",
  });
  const [decrypted, setDecrypted] = useState<any | null>(null);
  const [viewPassphrase, setViewPassphrase] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [acctData, credData] = await Promise.all([
          apiFetch<BankAccount[]>("/api/bank/accounts"),
          apiFetch<CredentialMeta[]>("/api/credentials/accounts"),
        ]);
        setAccounts(acctData);
        setCredentials(credData);
      } catch (error: any) {
        setFeedback({ type: "error", message: error.message || "Failed to load accounts" });
      }
    };
    load();
  }, []);

  const credentialMap = useMemo(() => {
    const map = new Map<string, CredentialMeta>();
    credentials.forEach((cred) => map.set(cred.bankAccountId, cred));
    return map;
  }, [credentials]);

  const openDialog = (account: BankAccount) => {
    setActiveAccount(account);
    setDialogOpen(true);
    setPassphrase("");
    setLabel(account.name || account.type || "Account");
    setForm({
      username: "",
      customerName: "",
      password: "",
      passphrase: "",
      memorableInfo: "",
      authDetails: "",
    });
  };

  const openView = (account: BankAccount) => {
    setActiveAccount(account);
    setViewOpen(true);
    setViewPassphrase("");
    setDecrypted(null);
  };

  const saveCredentials = async () => {
    if (!activeAccount) return;
    if (!passphrase) {
      setFeedback({ type: "error", message: "Enter a vault passphrase to encrypt credentials." });
      return;
    }
    try {
      const payload = await encryptPayload(passphrase, { ...form, label });
      await apiFetch("/api/credentials/accounts", {
        method: "POST",
        body: JSON.stringify({ bankAccountId: activeAccount.id, encryptedPayload: payload, label }),
      });
      setDialogOpen(false);
      setFeedback({ type: "success", message: "Credentials stored for account." });
      const updated = await apiFetch<CredentialMeta[]>("/api/credentials/accounts");
      setCredentials(updated);
    } catch (error: any) {
      setFeedback({ type: "error", message: error.message || "Failed to store credentials" });
    }
  };

  const handleDecrypt = async () => {
    if (!activeAccount) return;
    if (!viewPassphrase) {
      setFeedback({ type: "error", message: "Enter a passphrase to decrypt." });
      return;
    }
    try {
      const records = await apiFetch<any[]>(
        `/api/credentials/accounts?bankAccountId=${encodeURIComponent(activeAccount.id)}&includePayload=true`
      );
      const record = records?.[0];
      if (!record?.encryptedPayload) {
        setFeedback({ type: "error", message: "No encrypted payload found." });
        return;
      }
      const data = await decryptPayload(viewPassphrase, record.encryptedPayload);
      setDecrypted(data);
    } catch (error: any) {
      setFeedback({ type: "error", message: error.message || "Failed to decrypt credentials." });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Open Banking Credentials</CardTitle>
        <CardDescription>Add encrypted credentials for TrueLayer accounts (optional).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {feedback && (
          <Alert variant={feedback.type === "success" ? "default" : "destructive"}>
            <AlertTitle>{feedback.type === "success" ? "Success" : "Error"}</AlertTitle>
            <AlertDescription>{feedback.message}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => {
            const labelText = account.name || account.type || "Account";
            const hasCred = credentialMap.has(account.id);
            return (
              <div key={account.id} className="border rounded-lg p-3 space-y-2">
                <div className="font-medium">{labelText}</div>
                <div className="text-xs text-muted-foreground">
                  {account.mask ? `••${account.mask}` : account.providerAccountId || "—"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Credentials: {hasCred ? "Stored" : "Not stored"}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openDialog(account)}>
                    {hasCred ? "Update" : "Add"}
                  </Button>
                  {hasCred && (
                    <Button size="sm" variant="ghost" onClick={() => openView(account)}>
                      View
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {accounts.length === 0 && (
            <div className="text-sm text-muted-foreground">No Open Banking accounts found.</div>
          )}
        </div>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Store account credentials</DialogTitle>
            <DialogDescription>Encrypt and store credentials for this account.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Label</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Vault Passphrase</Label>
                <Input type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input value={form.username} onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Customer Name</Label>
                <Input
                  value={form.customerName}
                  onChange={(e) => setForm((prev) => ({ ...prev, customerName: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Password</Label>
                <Input value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Passphrase</Label>
                <Input value={form.passphrase} onChange={(e) => setForm((prev) => ({ ...prev, passphrase: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Memorable Info</Label>
                <Input
                  value={form.memorableInfo}
                  onChange={(e) => setForm((prev) => ({ ...prev, memorableInfo: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Auth Details</Label>
                <Input
                  value={form.authDetails}
                  onChange={(e) => setForm((prev) => ({ ...prev, authDetails: e.target.value }))}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Credentials are encrypted in the browser before saving.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveCredentials}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Decrypt account credentials</DialogTitle>
            <DialogDescription>Enter the passphrase used when saving.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Vault Passphrase</Label>
              <Input type="password" value={viewPassphrase} onChange={(e) => setViewPassphrase(e.target.value)} />
            </div>
            <Button onClick={handleDecrypt}>Decrypt</Button>
            {decrypted && (
              <div className="rounded-md border p-3 text-sm space-y-1">
                <div>Username: {decrypted.username || "—"}</div>
                <div>Customer Name: {decrypted.customerName || "—"}</div>
                <div>Password: {decrypted.password || "—"}</div>
                <div>Passphrase: {decrypted.passphrase || "—"}</div>
                <div>Memorable Info: {decrypted.memorableInfo || "—"}</div>
                <div>Auth Details: {decrypted.authDetails || "—"}</div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
