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
import { getErrorMessage } from "@/lib/errors";
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
  accountNumber?: string | null;
  sortCode?: string | null;
  statementBalance?: number | null;
  statementDate?: string | null;
  statementDueDate?: string | null;
  statementPaidAmount?: number | null;
  statementPaidComputed?: number | null;
  statementPayable?: number | null;
  statementDueInDays?: number | null;
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

type CredentialRecord = {
  encryptedPayload?: string | null;
};

export function ViewAccountDialog({
  account,
  triggerVariant = "default",
}: {
  account: BankAccountDisplay;
  triggerVariant?: "default" | "icon";
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [passphraseReady, setPassphraseReady] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [secureUnlocked, setSecureUnlocked] = useState(false);
  const [secureError, setSecureError] = useState<string | null>(null);
  const [secureData, setSecureData] = useState<AccountCredentials>({});
  const [shareOpen, setShareOpen] = useState(false);
  const [accountData, setAccountData] = useState({
    name: account.name || "",
    type: account.type || "account",
    currency: account.currency || "",
    mask: account.mask || "",
    bankName: account.tags?.startsWith("bank:") ? account.tags.replace("bank:", "") : "",
    accountNumber: account.accountNumber || "",
    sortCode: account.sortCode || "",
    statementBalance: account.statementBalance ?? 0,
    statementDate: account.statementDate ? account.statementDate.slice(0, 10) : "",
    statementDueDate: account.statementDueDate ? account.statementDueDate.slice(0, 10) : "",
    statementPaidAmount: account.statementPaidAmount ?? 0,
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

  const isCardType = useMemo(() => (accountData.type || "").toLowerCase().includes("card"), [accountData.type]);
  const computedPayable = useMemo(() => {
    const statementBalance = Number(accountData.statementBalance) || 0;
    const paidManual = Number(accountData.statementPaidAmount) || 0;
    const paidComputed = typeof account.statementPaidComputed === "number" ? account.statementPaidComputed : 0;
    return Math.max(0, statementBalance - Math.max(paidManual, paidComputed));
  }, [account.statementPaidComputed, accountData.statementBalance, accountData.statementPaidAmount]);
  const computedDueDays = useMemo(() => {
    if (account.statementDueInDays !== null && account.statementDueInDays !== undefined) {
      return account.statementDueInDays;
    }
    if (!accountData.statementDueDate) return null;
    const due = new Date(accountData.statementDueDate);
    const now = new Date();
    return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }, [account.statementDueInDays, accountData.statementDueDate]);

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
        accountNumber: account.accountNumber || "",
        sortCode: account.sortCode || "",
        statementBalance: account.statementBalance ?? 0,
        statementDate: account.statementDate ? account.statementDate.slice(0, 10) : "",
        statementDueDate: account.statementDueDate ? account.statementDueDate.slice(0, 10) : "",
        statementPaidAmount: account.statementPaidAmount ?? 0,
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
      const payloads = await apiFetch<CredentialRecord[]>(
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
    } catch (error) {
      setSecureError(getErrorMessage(error, "Failed to decrypt sensitive fields."));
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
        accountNumber: accountData.accountNumber || undefined,
        sortCode: accountData.sortCode || undefined,
        statementBalance: Number(accountData.statementBalance) || 0,
        statementDate: accountData.statementDate || undefined,
        statementDueDate: accountData.statementDueDate || undefined,
        statementPaidAmount: Number(accountData.statementPaidAmount) || 0,
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
    } catch (error) {
      setSecureError(getErrorMessage(error, "Failed to save account."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {triggerVariant === "icon" ? (
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-full"
          aria-label="View account"
          onClick={() => setOpen(true)}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Eye className="h-4 w-4 mr-2" />
          View
        </Button>
      )}
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

          {isCardType && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="text-sm font-semibold">Statement & Payable</div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="statementBalance">Statement Balance</Label>
                  <Input
                    id="statementBalance"
                    type="number"
                    value={accountData.statementBalance}
                    onChange={(e) => setAccountData((prev) => ({ ...prev, statementBalance: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="statementPaidAmount">Paid so far (manual)</Label>
                  <Input
                    id="statementPaidAmount"
                    type="number"
                    value={accountData.statementPaidAmount}
                    onChange={(e) => setAccountData((prev) => ({ ...prev, statementPaidAmount: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="statementDate">Statement Date</Label>
                  <Input
                    id="statementDate"
                    type="date"
                    value={accountData.statementDate}
                    onChange={(e) => setAccountData((prev) => ({ ...prev, statementDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="statementDueDate">Statement Due Date</Label>
                  <Input
                    id="statementDueDate"
                    type="date"
                    value={accountData.statementDueDate}
                    onChange={(e) => setAccountData((prev) => ({ ...prev, statementDueDate: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-md bg-slate-50 border px-3 py-2">
                  <div className="text-xs text-muted-foreground">Payable now</div>
                  <div className="text-base font-semibold">£{computedPayable.toFixed(2)}</div>
                </div>
                <div className="rounded-md bg-slate-50 border px-3 py-2">
                  <div className="text-xs text-muted-foreground">Due in</div>
                  <div className="text-base font-semibold">
                    {computedDueDays !== null ? `${computedDueDays} days` : "—"}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Auto-paid amount uses positive card transactions between statement and due dates when available.
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="accountNumber">Account Number</Label>
              <Input
                id="accountNumber"
                value={accountData.accountNumber}
                onChange={(e) => setAccountData((prev) => ({ ...prev, accountNumber: e.target.value }))}
                placeholder="Full account number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sortCode">Sort Code</Label>
              <Input
                id="sortCode"
                value={accountData.sortCode}
                onChange={(e) =>
                  setAccountData((prev) => ({
                    ...prev,
                    sortCode: e.target.value.replace(/[^0-9]/g, ""),
                  }))
                }
                placeholder="e.g. 202728"
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
                  <Link href="/settings" className="inline-flex">
                    <Button size="sm" variant="outline">
                      Go to Settings
                    </Button>
                  </Link>
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
        <Dialog open={shareOpen} onOpenChange={setShareOpen}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Share account details</DialogTitle>
              <DialogDescription>Copy the details below to share.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 text-sm whitespace-pre-line bg-slate-50 border rounded-md p-3">
              {[
                `Name: ${accountData.name || "—"}`,
                `Bank: ${accountData.bankName || bankLabel || "—"}`,
                `Sort Code: ${accountData.sortCode || "—"}`,
                `Account Number: ${accountData.accountNumber || "—"}`,
                `Currency: ${accountData.currency || "—"}`,
              ].join("\n")}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={async () => {
                  const text = [
                    `Name: ${accountData.name || "—"}`,
                    `Bank: ${accountData.bankName || bankLabel || "—"}`,
                    `Sort Code: ${accountData.sortCode || "—"}`,
                    `Account Number: ${accountData.accountNumber || "—"}`,
                    `Currency: ${accountData.currency || "—"}`,
                  ].join("\n");
                  await navigator.clipboard.writeText(text);
                }}
              >
                Copy details
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <DialogFooter className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <Button variant="outline" onClick={() => setShareOpen(true)}>
            Share details
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
