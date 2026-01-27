"use client";

import { useMemo, useRef, useState } from "react";
import {
  encryptVault,
  decryptVault,
  vaultExists,
  clearVault,
  exportVaultBundle,
  importVaultBundle,
} from "@/lib/vault";
import { getErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type VaultEntry = {
  id: string;
  label: string;
  type: "card" | "account" | "other";
  cardNumber?: string;
  accountNumber?: string;
  expiryDate?: string;
  cvv?: string;
  pin?: string;
  customerNumber?: string;
  bankingPassword?: string;
  notes?: string;
};

export function VaultClient() {
  const [passphrase, setPassphrase] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [unlocked, setUnlocked] = useState(false);
  const [draft, setDraft] = useState<VaultEntry>({
    id: "",
    label: "",
    type: "card",
    cardNumber: "",
    accountNumber: "",
    expiryDate: "",
    cvv: "",
    pin: "",
    customerNumber: "",
    bankingPassword: "",
    notes: "",
  });

  const hasVault = useMemo(() => {
    if (typeof window === "undefined") return false;
    return vaultExists();
  }, []);

  const lockVault = () => {
    setUnlocked(false);
    setEntries([]);
    setPassphrase("");
  };

  const handleUnlock = async () => {
    setError(null);
    setStatus(null);
    try {
      const data = await decryptVault(passphrase);
      if (!data) {
        setEntries([]);
      } else {
        setEntries(Array.isArray(data) ? (data as VaultEntry[]) : []);
      }
      setUnlocked(true);
      setStatus("Vault unlocked. Data stays on this device only.");
    } catch {
      setError("Failed to unlock vault. Check your passphrase.");
    }
  };

  const handleSave = async () => {
    setError(null);
    setStatus(null);
    try {
      await encryptVault(passphrase, entries);
      setStatus("Vault encrypted and saved locally.");
    } catch {
      setError("Failed to encrypt vault.");
    }
  };

  const handleAdd = () => {
    if (!draft.label) {
      setError("Label is required.");
      return;
    }
    const next: VaultEntry = { ...draft, id: crypto.randomUUID() };
    setEntries((prev) => [...prev, next]);
    setDraft({
      id: "",
      label: "",
      type: "card",
      cardNumber: "",
      accountNumber: "",
      expiryDate: "",
      cvv: "",
      pin: "",
      customerNumber: "",
      bankingPassword: "",
      notes: "",
    });
  };

  const handleDelete = (id: string) => {
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
  };

  const handleReset = () => {
    clearVault();
    setEntries([]);
    setUnlocked(false);
    setStatus("Vault cleared from this device.");
  };

  const handleExport = () => {
    const bundle = exportVaultBundle();
    if (!bundle) {
      setError("No vault data to export.");
      return;
    }
    const blob = new Blob([bundle], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "cardsense-vault.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      importVaultBundle(text);
      setStatus("Vault imported. Unlock with your passphrase.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to import vault."));
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Secure Vault (Local-Only)</CardTitle>
          <CardDescription>
            Data is encrypted in your browser and stored only on this device. It is never sent to the server.
            Avoid storing PIN/CVV unless you accept the risk.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="passphrase">Vault passphrase</Label>
            <Input
              id="passphrase"
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Enter a strong passphrase"
            />
            <p className="text-xs text-muted-foreground">
              You are responsible for remembering this passphrase. If you forget it, the vault cannot be recovered.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleUnlock} disabled={!passphrase}>
              {unlocked ? "Re-unlock" : hasVault ? "Unlock" : "Create Vault"}
            </Button>
            <Button variant="outline" onClick={handleSave} disabled={!unlocked || !passphrase}>
              Encrypt & Save
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={!hasVault}>
              Export Vault
            </Button>
            <div className="inline-flex items-center">
              <input
                type="file"
                accept="application/json"
                ref={fileInputRef}
                className="hidden"
                onChange={(e) => handleImport(e.target.files?.[0] || null)}
              />
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                Import Vault
              </Button>
            </div>
            <Button variant="ghost" onClick={lockVault} disabled={!unlocked}>
              Lock
            </Button>
            <Button variant="destructive" onClick={handleReset}>
              Clear Vault
            </Button>
          </div>

          {status && <p className="text-sm text-emerald-600">{status}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      {unlocked && (
        <Card>
          <CardHeader>
            <CardTitle>Add Entry</CardTitle>
            <CardDescription>Store card/account details securely on this device.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value as VaultEntry["type"] })}
              >
                <option value="card">Card</option>
                <option value="account">Account</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Card number</Label>
              <Input value={draft.cardNumber || ""} onChange={(e) => setDraft({ ...draft, cardNumber: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Account number</Label>
              <Input value={draft.accountNumber || ""} onChange={(e) => setDraft({ ...draft, accountNumber: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Expiry date</Label>
              <Input value={draft.expiryDate || ""} onChange={(e) => setDraft({ ...draft, expiryDate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>CVV</Label>
              <Input value={draft.cvv || ""} onChange={(e) => setDraft({ ...draft, cvv: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>PIN</Label>
              <Input value={draft.pin || ""} onChange={(e) => setDraft({ ...draft, pin: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Customer number</Label>
              <Input value={draft.customerNumber || ""} onChange={(e) => setDraft({ ...draft, customerNumber: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Banking password</Label>
              <Input
                value={draft.bankingPassword || ""}
                onChange={(e) => setDraft({ ...draft, bankingPassword: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Notes</Label>
              <Textarea value={draft.notes || ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Button onClick={handleAdd}>Add Entry</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {unlocked && entries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Stored Entries</CardTitle>
            <CardDescription>Remember to save after edits.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {entries.map((entry) => (
              <div key={entry.id} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{entry.label}</div>
                    <div className="text-xs text-muted-foreground">{entry.type}</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(entry.id)}>
                    Remove
                  </Button>
                </div>
                <div className="grid gap-2 md:grid-cols-2 text-sm">
                  <div>Card: {entry.cardNumber || "—"}</div>
                  <div>Account: {entry.accountNumber || "—"}</div>
                  <div>Expiry: {entry.expiryDate || "—"}</div>
                  <div>CVV: {entry.cvv || "—"}</div>
                  <div>PIN: {entry.pin || "—"}</div>
                  <div>Customer: {entry.customerNumber || "—"}</div>
                  <div>Password: {entry.bankingPassword || "—"}</div>
                </div>
                {entry.notes && <div className="text-xs text-muted-foreground">Notes: {entry.notes}</div>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
