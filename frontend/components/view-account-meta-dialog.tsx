"use client";

import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Eye, Plus, X } from "lucide-react";
import { apiFetch, getApiBaseUrl } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { decryptPayload, encryptPayload, passphraseMarkerExists } from "@/lib/vault";

type AccountMetaRecord = {
  id: string;
  accountType: string;
  label: string;
  accountHolderName?: string | null;
  bankName?: string | null;
  currency?: string | null;
  internationalAccountNumber?: string | null;
  accountNumber?: string | null;
  sortCode?: string | null;
  balance?: number | null;
  availableBalance?: number | null;
  limit?: number | null;
  cardNetwork?: string | null;
  cardLast4?: string | null;
  cardImageUrl?: string | null;
  documentImageUrls?: string[] | null;
  statementDay?: number | null;
  dueDay?: number | null;
  last3StatementDates?: string | null;
  last3DueDates?: string | null;
};

type SensitivePayload = {
  label?: string;
  username?: string;
  customerName?: string;
  password?: string;
  passphrase?: string;
  memorableInfo?: string;
  statementPassword?: string;
  fullCardNumber?: string;
  cvv?: string;
  pin?: string;
  expiryDate?: string;
  notes?: string;
};

type SensitiveRecord = { id?: string; encryptedPayload?: string | null };

const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_DOCUMENT_SIZE_LABEL = "5 MB";
const formatAmountInput = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return Number(value).toFixed(2);
};
const parseHolderName = (value: string | null | undefined) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^(.+?)\s*\([^)]*\)\s*$/);
  return match ? match[1].trim() : trimmed;
};

const serializeSnapshot = ({
  record,
  secureData,
  secureUnlocked,
}: {
  record: AccountMetaRecord | null;
  secureData: Record<string, unknown>;
  secureUnlocked: boolean;
}) =>
  JSON.stringify({
    record,
    secureData: secureUnlocked ? secureData : {},
  });

export function ViewAccountMetaDialog({
  accountMetaId,
  triggerVariant = "default",
}: {
  accountMetaId: string;
  triggerVariant?: "default" | "icon";
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [passphraseReady, setPassphraseReady] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [secureUnlocked, setSecureUnlocked] = useState(false);
  const [secureError, setSecureError] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [secureData, setSecureData] = useState<SensitivePayload>({});
  const [record, setRecord] = useState<AccountMetaRecord | null>(null);
  const [sensitiveInfoId, setSensitiveInfoId] = useState<string | null>(null);
  const [documentPreviewIndex, setDocumentPreviewIndex] = useState<number | null>(null);
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null);
  const [metaLoaded, setMetaLoaded] = useState(false);
  const [snapshotIncludesSecure, setSnapshotIncludesSecure] = useState(false);
  const isCardAccount = record?.accountType ? record.accountType.includes("CARD") : false;
  const isOverdraftAccount = record?.accountType === "OVERDRAFT";
  const balanceLabel = isCardAccount || isOverdraftAccount ? "Used Balance" : "Current Balance";
  const availableLabel = "Available Balance";
  const limitLabel = isOverdraftAccount ? "Overdraft Limit" : "Limit";

  useEffect(() => {
    if (!open) return;
    setPassphraseReady(passphraseMarkerExists());
    setSecureUnlocked(false);
    setSecureError(null);
    setDocumentError(null);
    setDocumentPreviewIndex(null);
    setPassphrase("");
    setSecureData({});
    setInitialSnapshot(null);
    setMetaLoaded(false);
    setSnapshotIncludesSecure(false);
    const load = async () => {
      try {
        const data = await apiFetch<AccountMetaRecord>(`/api/account-meta/${accountMetaId}`);
        setRecord({
          ...data,
          accountHolderName: parseHolderName(data.accountHolderName),
        });
      } catch (error) {
        setSecureError(getErrorMessage(error, "Failed to load account"));
      } finally {
        setMetaLoaded(true);
      }
    };
    void load();
  }, [open, accountMetaId]);

  useEffect(() => {
    if (!open || !metaLoaded || initialSnapshot !== null) return;
    setInitialSnapshot(
      serializeSnapshot({
        record,
        secureData,
        secureUnlocked,
      })
    );
  }, [initialSnapshot, metaLoaded, open, record, secureData, secureUnlocked]);

  const isDirty =
    initialSnapshot !== null &&
    serializeSnapshot({
      record,
      secureData,
      secureUnlocked,
    }) !== initialSnapshot;

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
      const payloads = await apiFetch<SensitiveRecord[]>(
        `/api/sensitive-info?accountMetaId=${encodeURIComponent(accountMetaId)}&includePayload=true`
      );
      const payload = payloads?.[0]?.encryptedPayload;
      setSensitiveInfoId(payloads?.[0]?.id || null);
      if (payload) {
        const decrypted = await decryptPayload(passphrase, payload);
        if (!snapshotIncludesSecure) {
          setInitialSnapshot(
            serializeSnapshot({
              record,
              secureData: decrypted || {},
              secureUnlocked: true,
            })
          );
          setSnapshotIncludesSecure(true);
        }
        setSecureData(decrypted || {});
      }
      setSecureUnlocked(true);
    } catch (error) {
      setSecureError(getErrorMessage(error, "Failed to decrypt sensitive fields."));
      setSecureUnlocked(false);
    }
  };

  const handleSave = async () => {
    if (!record) return;
    setSaving(true);
    setSecureError(null);
    try {
      await apiFetch(`/api/account-meta/${record.id}`, {
        method: "PUT",
        body: JSON.stringify(record),
      });
      if (secureUnlocked && passphrase) {
        const payload = await encryptPayload(passphrase, {
          ...secureData,
          label: secureData.label || record.label,
        });
        if (sensitiveInfoId) {
          await apiFetch(`/api/sensitive-info/${sensitiveInfoId}`, {
            method: "PUT",
            body: JSON.stringify({ encryptedPayload: payload, accountMetaId: record.id }),
          });
        } else {
          const created = await apiFetch<{ id: string }>(`/api/sensitive-info`, {
            method: "POST",
            body: JSON.stringify({ encryptedPayload: payload, accountMetaId: record.id }),
          });
          setSensitiveInfoId(created?.id || null);
        }
      }
      setOpen(false);
      window.location.reload();
    } catch (error) {
      setSecureError(getErrorMessage(error, "Failed to save account"));
    } finally {
      setSaving(false);
    }
  };

  const handleDocumentUpload = async (files: FileList | null) => {
    if (!files || !files.length || !record) return;
    setDocumentError(null);
    const accepted = Array.from(files).filter((file) => {
      if (file.size > MAX_DOCUMENT_SIZE_BYTES) return false;
      if (file.type && !(file.type.startsWith("image/") || file.type === "application/pdf")) return false;
      return true;
    });
    const rejected = Array.from(files).filter((file) => !accepted.includes(file));
    if (rejected.length) {
      setDocumentError(`Some files were skipped. Max size is ${MAX_DOCUMENT_SIZE_LABEL}.`);
    }
    if (!accepted.length) return;
    try {
      const formData = new FormData();
      accepted.forEach((file) => formData.append("files", file));
      const response = await fetch(`${getApiBaseUrl()}/api/account-meta/${record.id}/documents`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to upload documents");
      }
      const result = await response.json();
      const nextList = Array.isArray(result?.documentImageUrls) ? result.documentImageUrls : [];
      setRecord((prev) =>
        prev
          ? {
              ...prev,
              documentImageUrls: nextList.length ? nextList : prev.documentImageUrls,
            }
          : prev
      );
    } catch (error) {
      setSecureError(getErrorMessage(error, "Failed to upload documents."));
    }
  };

  const handleRemoveDocument = async (index: number) => {
    if (!record) return;
    try {
      const nextList = (record.documentImageUrls || []).filter((_, idx) => idx !== index);
      setRecord((prev) => (prev ? { ...prev, documentImageUrls: nextList } : prev));
      await apiFetch(`/api/account-meta/${record.id}`, {
        method: "PUT",
        body: JSON.stringify({ documentImageUrls: nextList }),
      });
    } catch (error) {
      setSecureError(getErrorMessage(error, "Failed to remove document."));
    }
  };

  const stripKeyPrefix = (value: string) => value.replace(/^local:|^gcs:/, "");
  const isInlineData = (value: string) => value.startsWith("data:");
  const isImageKey = (value: string) =>
    isInlineData(value) || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(stripKeyPrefix(value));
  const getDocumentUrl = (metaId: string, index: number) =>
    `${getApiBaseUrl()}/api/account-meta/${metaId}/documents/${index}`;

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
            Review and update account metadata. Sensitive fields require your passphrase.
          </DialogDescription>
        </DialogHeader>
        {!record ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Label</Label>
                <Input
                  value={record.label}
                  onChange={(e) => setRecord((prev) => prev ? { ...prev, label: e.target.value } : prev)}
                />
              </div>
              <div className="space-y-2">
                <Label>Account Type</Label>
                <Select
                  value={record.accountType}
                  onValueChange={(value) => setRecord((prev) => prev ? { ...prev, accountType: value } : prev)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account type" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "BANK_ACCOUNT",
                      "OVERDRAFT",
                      "CREDIT_CARD",
                      "DEBIT_CARD",
                      "CASH_ACCOUNT",
                      "CASH_CARD",
                      "OTHER",
                    ].map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Account Holder Name</Label>
                <Input
                  value={record.accountHolderName || ""}
                  onChange={(e) => setRecord((prev) => prev ? { ...prev, accountHolderName: e.target.value } : prev)}
                />
              </div>
              <div className="space-y-2">
                <Label>Bank Name</Label>
                <Input
                  value={record.bankName || ""}
                  onChange={(e) => setRecord((prev) => prev ? { ...prev, bankName: e.target.value } : prev)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input
                  value={record.currency || ""}
                  onChange={(e) => setRecord((prev) => prev ? { ...prev, currency: e.target.value } : prev)}
                />
              </div>
              <div className="space-y-2">
                <Label>{isCardAccount ? "Card last 4 digits" : "IBAN"}</Label>
                <Input
                  value={isCardAccount ? record.cardLast4 || "" : record.internationalAccountNumber || ""}
                  onChange={(e) =>
                    setRecord((prev) =>
                      prev
                        ? {
                            ...prev,
                            internationalAccountNumber: isCardAccount ? prev.internationalAccountNumber : e.target.value,
                            cardLast4: isCardAccount ? e.target.value : prev.cardLast4,
                          }
                        : prev
                    )
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Account Number</Label>
                <Input
                  value={record.accountNumber || ""}
                  onChange={(e) => setRecord((prev) => prev ? { ...prev, accountNumber: e.target.value } : prev)}
                />
              </div>
              <div className="space-y-2">
                <Label>Sort Code</Label>
                <Input
                  value={record.sortCode || ""}
                  onChange={(e) => setRecord((prev) => prev ? { ...prev, sortCode: e.target.value.replace(/[^0-9]/g, "") } : prev)}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{balanceLabel}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formatAmountInput(record.balance)}
                  onChange={(e) => setRecord((prev) => prev ? { ...prev, balance: Number(e.target.value) } : prev)}
                />
              </div>
              <div className="space-y-2">
                <Label>{availableLabel}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formatAmountInput(record.availableBalance)}
                  onChange={(e) => setRecord((prev) => prev ? { ...prev, availableBalance: Number(e.target.value) } : prev)}
                />
              </div>
              {(record.accountType !== "BANK_ACCOUNT") && (
                <div className="space-y-2">
                  <Label>{limitLabel}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formatAmountInput(record.limit)}
                    onChange={(e) => setRecord((prev) => prev ? { ...prev, limit: Number(e.target.value) } : prev)}
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Card Network</Label>
                <Input
                  value={record.cardNetwork || ""}
                  onChange={(e) => setRecord((prev) => prev ? { ...prev, cardNetwork: e.target.value } : prev)}
                />
              </div>
              {!isCardAccount && (
                <div className="space-y-2">
                  <Label>Card Last 4</Label>
                  <Input
                    value={record.cardLast4 || ""}
                    onChange={(e) => setRecord((prev) => prev ? { ...prev, cardLast4: e.target.value } : prev)}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Card Image URL</Label>
                <Input
                  value={record.cardImageUrl || ""}
                  onChange={(e) => setRecord((prev) => prev ? { ...prev, cardImageUrl: e.target.value } : prev)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Document Images</Label>
              <div className="flex flex-wrap items-center gap-2">
                {(record.documentImageUrls || []).map((url, index) => (
                  <div
                    key={`${url}-${index}`}
                    role="button"
                    tabIndex={0}
                    className="group relative h-12 w-12 overflow-hidden rounded-md border"
                    onClick={() => setDocumentPreviewIndex(index)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setDocumentPreviewIndex(index);
                      }
                    }}
                  >
                    {isImageKey(url) ? (
                      <img
                        src={isInlineData(url) ? url : getDocumentUrl(record.id, index)}
                        alt="Document"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-50 text-[10px] font-semibold text-slate-500">
                        FILE
                      </div>
                    )}
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-xs opacity-0 shadow-sm transition group-hover:opacity-100"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleRemoveDocument(index);
                      }}
                      aria-label="Remove image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <label className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-md border border-dashed text-muted-foreground hover:text-foreground">
                  <Plus className="h-4 w-4" />
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => void handleDocumentUpload(e.target.files)}
                  />
                </label>
              </div>
              {documentError && <p className="text-xs text-red-600">{documentError}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Statement Day</Label>
                <Input
                  value={record.statementDay ?? ""}
                  onChange={(e) => setRecord((prev) => prev ? { ...prev, statementDay: Number(e.target.value) } : prev)}
                />
              </div>
              <div className="space-y-2">
                <Label>Due Day</Label>
                <Input
                  value={record.dueDay ?? ""}
                  onChange={(e) => setRecord((prev) => prev ? { ...prev, dueDay: Number(e.target.value) } : prev)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Last 3 Statement Dates</Label>
                <Input
                  value={record.last3StatementDates || ""}
                  onChange={(e) => setRecord((prev) => prev ? { ...prev, last3StatementDates: e.target.value } : prev)}
                />
              </div>
              <div className="space-y-2">
                <Label>Last 3 Due Dates</Label>
                <Input
                  value={record.last3DueDates || ""}
                  onChange={(e) => setRecord((prev) => prev ? { ...prev, last3DueDates: e.target.value } : prev)}
                />
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <div className="text-sm font-semibold">Sensitive credentials</div>
              {!passphraseReady && (
                <Alert variant="destructive">
                  <AlertTitle>Passphrase required</AlertTitle>
                  <AlertDescription>
                    Set a passphrase in Settings to view sensitive fields.
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
                    <Input value={secureData.label || ""} onChange={(e) => setSecureData((prev) => ({ ...prev, label: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <Input value={secureData.username || ""} onChange={(e) => setSecureData((prev) => ({ ...prev, username: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Customer Name</Label>
                    <Input value={secureData.customerName || ""} onChange={(e) => setSecureData((prev) => ({ ...prev, customerName: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input value={secureData.password || ""} onChange={(e) => setSecureData((prev) => ({ ...prev, password: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Passphrase</Label>
                    <Input value={secureData.passphrase || ""} onChange={(e) => setSecureData((prev) => ({ ...prev, passphrase: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Memorable Info</Label>
                    <Input value={secureData.memorableInfo || ""} onChange={(e) => setSecureData((prev) => ({ ...prev, memorableInfo: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Statement Password</Label>
                    <Input value={secureData.statementPassword || ""} onChange={(e) => setSecureData((prev) => ({ ...prev, statementPassword: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Full Card Number</Label>
                    <Input value={secureData.fullCardNumber || ""} onChange={(e) => setSecureData((prev) => ({ ...prev, fullCardNumber: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>CVV</Label>
                    <Input value={secureData.cvv || ""} onChange={(e) => setSecureData((prev) => ({ ...prev, cvv: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>PIN</Label>
                    <Input value={secureData.pin || ""} onChange={(e) => setSecureData((prev) => ({ ...prev, pin: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Expiry Date</Label>
                    <Input value={secureData.expiryDate || ""} onChange={(e) => setSecureData((prev) => ({ ...prev, expiryDate: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Input value={secureData.notes || ""} onChange={(e) => setSecureData((prev) => ({ ...prev, notes: e.target.value }))} />
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Sensitive fields are encrypted before saving.</p>
            </div>
          </div>
        )}
        <Dialog open={documentPreviewIndex !== null} onOpenChange={() => setDocumentPreviewIndex(null)}>
          <DialogContent className="sm:max-w-[640px]">
            <DialogHeader>
              <DialogTitle>Document preview</DialogTitle>
            </DialogHeader>
            {record && documentPreviewIndex !== null && (
              isImageKey(record.documentImageUrls?.[documentPreviewIndex] || "") ? (
                <img
                  src={
                    isInlineData(record.documentImageUrls?.[documentPreviewIndex] || "")
                      ? record.documentImageUrls?.[documentPreviewIndex] || ""
                      : getDocumentUrl(record.id, documentPreviewIndex)
                  }
                  alt="Document preview"
                  className="h-auto w-full rounded-md border object-contain"
                />
              ) : (
                <iframe
                  title="Document preview"
                  src={getDocumentUrl(record.id, documentPreviewIndex)}
                  className="h-[70vh] w-full rounded-md border"
                />
              )
            )}
          </DialogContent>
        </Dialog>
        <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2">
          <Button
            onClick={isDirty ? handleSave : () => setOpen(false)}
            disabled={saving || !record}
          >
            {saving ? "Saving..." : isDirty ? "Save Changes" : "Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
