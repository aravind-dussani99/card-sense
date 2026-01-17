"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Eye } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { decryptPayload, encryptPayload, passphraseMarkerExists } from "@/lib/vault";
import { updateBankAccount } from "@/app/actions/bank-actions";
import { createBankAccountCredential } from "@/app/actions/credential-actions";

type BankAccountDisplay = {
  id: string;
  name?: string | null;
  type?: string | null;
  currency?: string | null;
  providerAccountId?: string | null;
  mask?: string | null;
  tags?: string | null;
  balance?: number | null;
  availableBalance?: number | null;
  limit?: number | null;
  connection?: { institutionId?: string | null; provider?: string | null } | null;
};

type AccountCredentials = {
  label?: string;
  username?: string;
  customerName?: string;
  password?: string;
  passphrase?: string;
  memorableInfo?: string;
  authDetails?: string;
  statementPassword?: string;
};

export function ViewAccountDialog({ account }: { account: BankAccountDisplay }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [passphraseReady, setPassphraseReady] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [secureUnlocked, setSecureUnlocked] = useState(false);
  const [secureError, setSecureError] = useState<string | null>(null);
  const [secureData, setSecureData] = useState<AccountCredentials>({});
  const [accountData, setAccountData] = useState({
    name: account.name || "",
    type: account.type || "account",
    currency: account.currency || "",
    mask: account.mask || "",
    bankName: account.tags?.startsWith("bank:") ? account.tags.replace("bank:", "") : "",
    balance: account.balance ?? 0,
    availableBalance: account.availableBalance ?? account.balance ?? 0,
    limit: account.limit ?? 0,
  });

  const bankLabel = useMemo(() => {
    if (account.connection?.institutionId) return account.connection.institutionId;
    if (account.connection?.provider) return account.connection.provider;
    if (account.tags?.startsWith("bank:")) return account.tags.replace("bank:", "");
    return "Bank";
  }, [account.connection, account.tags]);

  useEffect(() => {
    if (open) {
      setPassphraseReady(passphraseMarkerExists());
      setSecureUnlocked(false);
      setSecureError(null);
      setPassphrase("");
      setSecureData({});
      setAccountData({
        name: account.name || "",
        type: account.type || "account",
        currency: account.currency || "",
        mask: account.mask || "",
        bankName: account.tags?.startsWith("bank:") ? account.tags.replace("bank:", "") : "",
        balance: account.balance ?? 0,
        availableBalance: account.availableBalance ?? account.balance ?? 0,
        limit: account.limit ?? 0,
      });
    }
  }, [open, account]);

  const handleUnlock = async () => {
    setSecureError(null);
    if (!passphraseReady) {
      setSecureError("Set a passphrase in Settings to view sensitive fields.");
      return;
    }
    if (!passphrase) {
      setSecureError("Enter your passphrase to unlock sensitive fields.");
      return;
    }
    try {
      const payloads = await apiFetch<any[]>(
        `/api/credentials/accounts?bankAccountId=${encodeURIComponent(account.id)}&includePayload=true`
      );
      const payload = payloads?.[0]?.encryptedPayload;
      if (payload) {
        const decrypted = await decryptPayload(passphrase, payload);
        setSecureData({
          label: decrypted.label,
          username: decrypted.username,
          customerName: decrypted.customerName,
          password: decrypted.password,
          passphrase: decrypted.passphrase,
          memorableInfo: decrypted.memorableInfo,
          authDetails: decrypted.authDetails,
          statementPassword: decrypted.statementPassword,
        });
      }
      setSecureUnlocked(true);
    } catch (error: any) {
      setSecureError(error.message || "Failed to decrypt sensitive fields.");
      setSecureUnlocked(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSecureError(null);
    try {
      const tagName = accountData.bankName ? `bank:${accountData.bankName}` : account.tags || null;
      const updateResult = await updateBankAccount(account.id, {
        name: accountData.name || undefined,
        type: accountData.type || undefined,
        currency: accountData.currency || undefined,
        mask: accountData.mask || undefined,
        tags: tagName || undefined,
        balance: Number(accountData.balance) || 0,
        availableBalance: Number(accountData.availableBalance) || 0,
        limit: Number(accountData.limit) || 0,
      });
      if (updateResult?.success === false) {
        throw new Error(updateResult.error || "Failed to update account.");
      }
      if (secureUnlocked && passphrase) {
        const payload = await encryptPayload(passphrase, {
          ...secureData,
          label: secureData.label || accountData.name || bankLabel,
        });
        await createBankAccountCredential(account.id, payload, secureData.label || accountData.name || bankLabel);
      }
      setOpen(false);
      window.location.reload();
    } catch (error: any) {
      setSecureError(error.message || "Failed to save account.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Eye className="h-4 w-4 mr-2" />
        View
      </Button>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>View & Edit Account</DialogTitle>
          <DialogDescription>
            Review and update account details. Sensitive fields require your passphrase.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="accountName">Account Name</Label>
              <Input
                id="accountName"
                value={accountData.name}
                onChange={(e) => setAccountData((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bankName">Bank Name</Label>
              <Input
                id="bankName"
                value={accountData.bankName || bankLabel}
                onChange={(e) => setAccountData((prev) => ({ ...prev, bankName: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="accountType">Account Type</Label>
              <Input
                id="accountType"
                value={accountData.type}
                onChange={(e) => setAccountData((prev) => ({ ...prev, type: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                value={accountData.currency}
                onChange={(e) => setAccountData((prev) => ({ ...prev, currency: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mask">Account Number (last 4)</Label>
              <Input
                id="mask"
                value={accountData.mask}
                onChange={(e) => setAccountData((prev) => ({ ...prev, mask: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="balance">Current Balance</Label>
              <Input
                id="balance"
                type="number"
                value={accountData.balance}
                onChange={(e) => setAccountData((prev) => ({ ...prev, balance: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="availableBalance">Available Balance</Label>
              <Input
                id="availableBalance"
                type="number"
                value={accountData.availableBalance}
                onChange={(e) => setAccountData((prev) => ({ ...prev, availableBalance: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="limit">Limit</Label>
              <Input
                id="limit"
                type="number"
                value={accountData.limit}
                onChange={(e) => setAccountData((prev) => ({ ...prev, limit: Number(e.target.value) }))}
              />
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="text-sm font-semibold">Sensitive credentials</div>
            {!passphraseReady && (
              <Alert variant="destructive">
                <AlertTitle>Passphrase required</AlertTitle>
                <AlertDescription className="flex flex-wrap items-center gap-2">
                  <span>Set a passphrase in Settings to view sensitive fields.</span>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/settings">Go to Settings</Link>
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="passphrase">Passphrase</Label>
                <Input
                  id="passphrase"
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Enter passphrase"
                />
              </div>
              <div className="flex items-end">
                <Button type="button" variant="outline" onClick={handleUnlock} disabled={!passphraseReady}>
                  Unlock
                </Button>
              </div>
            </div>
            {secureError && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{secureError}</AlertDescription>
              </Alert>
            )}
            {secureUnlocked && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Credential Label</Label>
                  <Input
                    value={secureData.label || ""}
                    onChange={(e) => setSecureData((prev) => ({ ...prev, label: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input
                    value={secureData.username || ""}
                    onChange={(e) => setSecureData((prev) => ({ ...prev, username: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Customer Name</Label>
                  <Input
                    value={secureData.customerName || ""}
                    onChange={(e) => setSecureData((prev) => ({ ...prev, customerName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    value={secureData.password || ""}
                    onChange={(e) => setSecureData((prev) => ({ ...prev, password: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Passphrase</Label>
                  <Input
                    value={secureData.passphrase || ""}
                    onChange={(e) => setSecureData((prev) => ({ ...prev, passphrase: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Memorable Info</Label>
                  <Input
                    value={secureData.memorableInfo || ""}
                    onChange={(e) => setSecureData((prev) => ({ ...prev, memorableInfo: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Auth Details</Label>
                  <Input
                    value={secureData.authDetails || ""}
                    onChange={(e) => setSecureData((prev) => ({ ...prev, authDetails: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Statement Password</Label>
                  <Input
                    value={secureData.statementPassword || ""}
                    onChange={(e) => setSecureData((prev) => ({ ...prev, statementPassword: e.target.value }))}
                  />
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Sensitive fields are encrypted before saving.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
