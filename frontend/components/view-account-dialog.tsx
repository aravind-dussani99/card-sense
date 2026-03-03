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
import { Eye, EyeOff, Plus, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiFetch, getApiBaseUrl } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { decryptPayload, encryptPayload, passphraseMarkerExists } from "@/lib/vault";

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
  statementPassword?: string;
  fullCardNumber?: string;
  nameOnCard?: string;
  expiryDate?: string;
  cvv?: string;
};

type CredentialRecord = {
  id?: string;
  encryptedPayload?: string | null;
};

const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_DOCUMENT_SIZE_LABEL = "5 MB";
const AUTO_LOCK_MS = 2 * 60 * 1000;
const inferAccountType = (value?: string | null) => {
  const normalized = (value || "").toLowerCase();
  if (normalized.includes("overdraft")) return "OVERDRAFT";
  if (normalized.includes("card") || normalized.includes("credit")) return "CREDIT_CARD";
  if (normalized.includes("debit")) return "DEBIT_CARD";
  return "BANK_ACCOUNT";
};
const parseDateList = (value?: string | null) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
};
const getMedianDay = (dates: string[]) => {
  const days = dates
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()))
    .map((value) => value.getDate())
    .sort((a, b) => a - b);
  if (!days.length) return null;
  const mid = Math.floor(days.length / 2);
  return days.length % 2 === 0 ? Math.round((days[mid - 1] + days[mid]) / 2) : days[mid];
};
const predictNextDate = (history: string[], reference = new Date()) => {
  const medianDay = getMedianDay(history);
  if (!medianDay) return "";
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const clampedDay = Math.min(medianDay, daysInMonth);
  const candidate = new Date(year, month, clampedDay);
  if (candidate < reference) {
    const nextMonth = new Date(year, month + 1, 1);
    const nextMonthDays = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
    const nextDay = Math.min(medianDay, nextMonthDays);
    return new Date(nextMonth.getFullYear(), nextMonth.getMonth(), nextDay).toISOString().slice(0, 10);
  }
  return candidate.toISOString().slice(0, 10);
};
const pushDateHistory = (current: string[], nextValue: string) => {
  if (!nextValue) return current;
  const trimmed = nextValue.trim();
  const next = [...current.filter((entry) => entry !== trimmed), trimmed];
  return next.slice(-3);
};
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
  accountData,
  accountMetaData,
  secureData,
  secureUnlocked,
}: {
  accountData: Record<string, unknown>;
  accountMetaData: Record<string, unknown>;
  secureData: Record<string, unknown>;
  secureUnlocked: boolean;
}) =>
  JSON.stringify({
    accountData,
    accountMetaData,
    secureData: secureUnlocked ? secureData : {},
  });

export function ViewAccountDialog({
  account,
  triggerVariant = "default",
  context = "bank",
}: {
  account: BankAccountDisplay;
  triggerVariant?: "default" | "icon";
  context?: "bank" | "overdraft" | "card";
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [passphraseReady, setPassphraseReady] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [passphraseVisible, setPassphraseVisible] = useState(false);
  const [secureUnlocked, setSecureUnlocked] = useState(false);
  const [secureError, setSecureError] = useState<string | null>(null);
  const [secureData, setSecureData] = useState<AccountCredentials>({});
  const [accountMetaId, setAccountMetaId] = useState<string | null>(null);
  const [sensitiveInfoId, setSensitiveInfoId] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [statusDialog, setStatusDialog] = useState<{ title: string; message: string } | null>(null);
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null);
  const [metaLoaded, setMetaLoaded] = useState(false);
  const [snapshotIncludesSecure, setSnapshotIncludesSecure] = useState(false);
  const [accountMetaData, setAccountMetaData] = useState({
    accountHolderName: "",
    bankName: "",
    accountType: "BANK_ACCOUNT",
    internationalAccountNumber: "",
    cardLast4: "",
    accountNumber: "",
    sortCode: "",
    documentImageUrls: [] as string[],
    sensitiveDocumentImageUrls: [] as string[],
    last3StatementDates: "[]",
    last3DueDates: "[]",
  });
  const [shareOpen, setShareOpen] = useState(false);
  const [copyNoticeOpen, setCopyNoticeOpen] = useState(false);
  const [documentPreview, setDocumentPreview] = useState<{ index: number; scope: "standard" | "sensitive" } | null>(null);
  const [statementDateInput, setStatementDateInput] = useState("");
  const [statementDueDateInput, setStatementDueDateInput] = useState("");
  const [accountData, setAccountData] = useState({
    name: account.name || "",
    type: account.type || "account",
    currency: account.currency || "",
    mask: account.mask || "",
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
    if (account.tags?.startsWith("bank:")) return account.tags.replace("bank:", "");
    if (account.name) return account.name;
    return "Bank";
  }, [account.connection, account.tags, account.name]);

  const isCardType = useMemo(() => (accountData.type || "").toLowerCase().includes("card"), [accountData.type]);
  const isCardAccount = context === "card" || isCardType;
  const isReadOnlyMask = Boolean(account.mask);
  const isReadOnlyAccountNumber = Boolean(account.accountNumber);
  const isReadOnlySortCode = Boolean(account.sortCode);
  const isReadOnlyCurrency = Boolean(account.currency);
  const isReadOnlyBalance = typeof account.balance === "number";
  const isReadOnlyAvailableBalance = typeof account.availableBalance === "number";
  const isReadOnlyLimit = typeof account.limit === "number";
  const isOverdraftAccount = useMemo(() => {
    if (context === "overdraft") return true;
    const type = (account.type || "").toLowerCase();
    const name = (account.name || "").toLowerCase();
    return !isCardAccount && (type.includes("overdraft") || name.includes("overdraft") || (account.limit ?? 0) > 0);
  }, [account.type, account.name, account.limit, context, isCardAccount]);
  const overdraftUsed = useMemo(() => {
    if (!isOverdraftAccount || typeof accountData.limit !== "number") return 0;
    const available = typeof accountData.availableBalance === "number" ? accountData.availableBalance : accountData.limit;
    return Math.max(0, accountData.limit - available);
  }, [accountData.availableBalance, accountData.limit, isOverdraftAccount]);
  const overdraftRemaining = useMemo(() => {
    if (!isOverdraftAccount || typeof accountData.limit !== "number") return accountData.availableBalance;
    return Math.max(0, accountData.limit - overdraftUsed);
  }, [accountData.availableBalance, accountData.limit, isOverdraftAccount, overdraftUsed]);
  const displayBalance = useMemo(() => {
    if (isCardAccount) {
      if (typeof accountData.limit === "number" && typeof accountData.availableBalance === "number") {
        return Math.max(0, accountData.limit - accountData.availableBalance);
      }
      return accountData.balance;
    }
    if (context === "bank" && typeof accountData.limit === "number" && accountData.limit > 0) {
      if (typeof accountData.balance === "number") return accountData.balance;
      if (typeof accountData.availableBalance === "number") return accountData.availableBalance - accountData.limit;
    }
    return isOverdraftAccount ? overdraftUsed : accountData.balance;
  }, [
    accountData.availableBalance,
    accountData.balance,
    accountData.limit,
    context,
    isCardAccount,
    isOverdraftAccount,
    overdraftUsed,
  ]);
  const displayAvailableBalance = useMemo(() => {
    if (isCardAccount) return accountData.availableBalance;
    if (context === "bank" && typeof accountData.limit === "number" && accountData.limit > 0) {
      if (typeof accountData.balance === "number") return accountData.balance;
      if (typeof accountData.availableBalance === "number") return accountData.availableBalance - accountData.limit;
    }
    return isOverdraftAccount ? overdraftRemaining : accountData.availableBalance;
  }, [accountData.availableBalance, accountData.balance, accountData.limit, context, isCardAccount, isOverdraftAccount, overdraftRemaining]);
  const displayLimit = isCardAccount || isOverdraftAccount ? accountData.limit : 0;
  const balanceLabel = isCardAccount || isOverdraftAccount ? "Used Balance" : "Current Balance";
  const availableLabel = "Available Balance";
  const limitLabel = isOverdraftAccount ? "Overdraft Limit" : "Limit";
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
      setDocumentError(null);
      setDocumentPreview(null);
      setPassphrase("");
      setSecureData({});
      setInitialSnapshot(null);
      setMetaLoaded(false);
      setSnapshotIncludesSecure(false);
      setAccountData({
        name: account.name || "",
        type: account.type || "account",
        currency: account.currency || "",
        mask: account.mask || "",
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
      const loadMeta = async () => {
        try {
          const meta = await apiFetch<Array<{
            id: string;
            accountHolderName?: string | null;
            bankName?: string | null;
            accountType?: string;
            internationalAccountNumber?: string | null;
            cardLast4?: string | null;
            accountNumber?: string | null;
            sortCode?: string | null;
            documentImageUrls?: string[] | null;
            sensitiveDocumentImageUrls?: string[] | null;
            last3StatementDates?: string | null;
            last3DueDates?: string | null;
          }>>(`/api/account-meta?linkedBankAccountId=${encodeURIComponent(account.id)}`);
          if (meta && meta.length) {
            const record = meta[0];
            const fallbackHolderName = parseHolderName(account.name);
            const statementDates = parseDateList(record.last3StatementDates);
            const dueDates = parseDateList(record.last3DueDates);
            setAccountMetaId(record.id);
            setAccountMetaData({
              accountHolderName: parseHolderName(record.accountHolderName) || fallbackHolderName,
              bankName: record.bankName || bankLabel,
              accountType: record.accountType || inferAccountType(account.type || ""),
              internationalAccountNumber: record.internationalAccountNumber || account.mask || "",
              cardLast4: record.cardLast4 || account.mask || "",
              accountNumber: record.accountNumber || account.accountNumber || "",
              sortCode: record.sortCode || account.sortCode || "",
              documentImageUrls: record.documentImageUrls || [],
              sensitiveDocumentImageUrls: record.sensitiveDocumentImageUrls || [],
              last3StatementDates: record.last3StatementDates || "[]",
              last3DueDates: record.last3DueDates || "[]",
            });
            setStatementDateInput(
              account.statementDate ? account.statementDate.slice(0, 10) : predictNextDate(statementDates)
            );
            setStatementDueDateInput(
              account.statementDueDate ? account.statementDueDate.slice(0, 10) : predictNextDate(dueDates)
            );
          } else {
            const fallbackHolderName = parseHolderName(account.name);
            setAccountMetaId(null);
            setAccountMetaData({
              accountHolderName: fallbackHolderName,
              bankName: bankLabel,
              accountType: inferAccountType(account.type || ""),
              internationalAccountNumber: account.mask || "",
              cardLast4: account.mask || "",
              accountNumber: account.accountNumber || "",
              sortCode: account.sortCode || "",
              documentImageUrls: [],
              sensitiveDocumentImageUrls: [],
              last3StatementDates: "[]",
              last3DueDates: "[]",
            });
            setStatementDateInput(
              account.statementDate ? account.statementDate.slice(0, 10) : predictNextDate([])
            );
            setStatementDueDateInput(
              account.statementDueDate ? account.statementDueDate.slice(0, 10) : predictNextDate([])
            );
          }
        } catch (error) {
          console.error("Failed to load account metadata", error);
        } finally {
          setMetaLoaded(true);
        }
      };
      void loadMeta();
    }
  }, [open, account]);

  useEffect(() => {
    if (!open || !metaLoaded || initialSnapshot !== null) return;
    setInitialSnapshot(
      serializeSnapshot({
        accountData,
        accountMetaData,
        secureData,
        secureUnlocked,
      })
    );
  }, [accountData, accountMetaData, initialSnapshot, metaLoaded, open, secureData, secureUnlocked]);

  const lockSensitive = () => {
    setSecureUnlocked(false);
    setSecureData({});
    setSecureError(null);
  };

  useEffect(() => {
    if (!secureUnlocked) return;
    const timeout = setTimeout(() => {
      lockSensitive();
    }, AUTO_LOCK_MS);
    return () => clearTimeout(timeout);
  }, [secureUnlocked]);

  const isDirty =
    initialSnapshot !== null &&
    serializeSnapshot({
      accountData,
      accountMetaData,
      secureData,
      secureUnlocked,
    }) !== initialSnapshot;

  const ensureAccountMeta = async () => {
    if (accountMetaId) return accountMetaId;
      const created = await apiFetch<{ id: string }>(`/api/account-meta`, {
        method: "POST",
        body: JSON.stringify({
          linkedBankAccountId: account.id,
          accountHolderName: accountMetaData.accountHolderName || undefined,
          bankName: accountMetaData.bankName || undefined,
          accountType: accountMetaData.accountType || inferAccountType(account.type || ""),
          internationalAccountNumber: accountMetaData.internationalAccountNumber || undefined,
          cardLast4: accountMetaData.cardLast4 || undefined,
          accountNumber: accountMetaData.accountNumber || undefined,
          sortCode: accountMetaData.sortCode || undefined,
          documentImageUrls: accountMetaData.documentImageUrls,
          sensitiveDocumentImageUrls: accountMetaData.sensitiveDocumentImageUrls,
          last3StatementDates: accountMetaData.last3StatementDates || undefined,
          last3DueDates: accountMetaData.last3DueDates || undefined,
          label: accountData.name || account.name || "Account",
        }),
      });
    const metaId = created?.id || null;
    setAccountMetaId(metaId);
    return metaId;
  };

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
      const metaId = await ensureAccountMeta();
      if (!metaId) {
        setSecureError("Save account details before unlocking sensitive fields.");
        return;
      }
      const payloads = await apiFetch<CredentialRecord[]>(
        `/api/sensitive-info?accountMetaId=${encodeURIComponent(metaId)}&includePayload=true`
      );
      const payload = payloads?.[0]?.encryptedPayload;
      setSensitiveInfoId(payloads?.[0]?.id || null);
      if (payload) {
        const decrypted = await decryptPayload(passphrase, payload);
        if (!snapshotIncludesSecure) {
          setInitialSnapshot(
            serializeSnapshot({
              accountData,
              accountMetaData,
              secureData: decrypted,
              secureUnlocked: true,
            })
          );
          setSnapshotIncludesSecure(true);
        }
        setSecureData({
          label: decrypted.label,
          username: decrypted.username,
          customerName: decrypted.customerName,
          password: decrypted.password,
          passphrase: decrypted.passphrase,
          memorableInfo: decrypted.memorableInfo,
          statementPassword: decrypted.statementPassword,
          fullCardNumber: decrypted.fullCardNumber,
          nameOnCard: decrypted.nameOnCard,
          expiryDate: decrypted.expiryDate,
          cvv: decrypted.cvv,
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
      let metaId = accountMetaId;
      if (metaId) {
        await apiFetch(`/api/account-meta/${metaId}`, {
          method: "PUT",
          body: JSON.stringify({
            linkedBankAccountId: account.id,
            accountHolderName: accountMetaData.accountHolderName || undefined,
            bankName: accountMetaData.bankName || undefined,
            accountType: accountMetaData.accountType || inferAccountType(account.type || ""),
            internationalAccountNumber: accountMetaData.internationalAccountNumber || undefined,
            cardLast4: accountMetaData.cardLast4 || undefined,
            accountNumber: accountMetaData.accountNumber || undefined,
            sortCode: accountMetaData.sortCode || undefined,
            documentImageUrls: accountMetaData.documentImageUrls,
            sensitiveDocumentImageUrls: accountMetaData.sensitiveDocumentImageUrls,
            last3StatementDates: accountMetaData.last3StatementDates || undefined,
            last3DueDates: accountMetaData.last3DueDates || undefined,
            label: accountData.name || account.name || "Account",
          }),
        });
      } else {
        const created = await apiFetch<{ id: string }>(`/api/account-meta`, {
          method: "POST",
          body: JSON.stringify({
            linkedBankAccountId: account.id,
            accountHolderName: accountMetaData.accountHolderName || undefined,
            bankName: accountMetaData.bankName || undefined,
            accountType: accountMetaData.accountType || inferAccountType(account.type || ""),
            internationalAccountNumber: accountMetaData.internationalAccountNumber || undefined,
            cardLast4: accountMetaData.cardLast4 || undefined,
            accountNumber: accountMetaData.accountNumber || undefined,
            sortCode: accountMetaData.sortCode || undefined,
            documentImageUrls: accountMetaData.documentImageUrls,
            sensitiveDocumentImageUrls: accountMetaData.sensitiveDocumentImageUrls,
            last3StatementDates: accountMetaData.last3StatementDates || undefined,
            last3DueDates: accountMetaData.last3DueDates || undefined,
            label: accountData.name || account.name || "Account",
          }),
        });
        metaId = created?.id || null;
        setAccountMetaId(metaId);
      }
      if (secureUnlocked && passphrase) {
        const payload = await encryptPayload(passphrase, {
          ...secureData,
          label: secureData.label || accountData.name || bankLabel,
        });
        if (metaId) {
          if (sensitiveInfoId) {
            await apiFetch(`/api/sensitive-info/${sensitiveInfoId}`, {
              method: "PUT",
              body: JSON.stringify({ encryptedPayload: payload, accountMetaId: metaId }),
            });
          } else {
            const createdSensitive = await apiFetch<{ id: string }>(`/api/sensitive-info`, {
              method: "POST",
              body: JSON.stringify({ encryptedPayload: payload, accountMetaId: metaId }),
            });
            setSensitiveInfoId(createdSensitive?.id || null);
          }
        }
      }
      setOpen(false);
      window.location.reload();
    } catch (error) {
      setSecureError(getErrorMessage(error, "Failed to save account."));
    } finally {
      setSaving(false);
    }
  };

  const handleDocumentUpload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setDocumentError(null);
    const accepted = Array.from(files).filter((file) => {
      if (file.size > MAX_DOCUMENT_SIZE_BYTES) return false;
      if (file.type && !(file.type.startsWith("image/") || file.type === "application/pdf")) return false;
      return true;
    });
    const rejected = Array.from(files).filter((file) => !accepted.includes(file));
    if (rejected.length) {
      const message = `Some files were skipped. Max size is ${MAX_DOCUMENT_SIZE_LABEL}.`;
      setDocumentError(message);
      setStatusDialog({ title: "Document upload issue", message });
    }
    if (!accepted.length) return;
    try {
      const metaId = await ensureAccountMeta();
      if (!metaId) {
        const message = "Save account details before uploading documents.";
        setDocumentError(message);
        setStatusDialog({ title: "Document upload issue", message });
        return;
      }
      const formData = new FormData();
      accepted.forEach((file) => formData.append("files", file));
      const result = await apiFetch<{ documentImageUrls?: string[] }>(
        `/api/account-meta/${metaId}/documents`,
        {
          method: "POST",
          body: formData,
        }
      );
      const nextList = Array.isArray(result?.documentImageUrls) ? result.documentImageUrls : [];
      setAccountMetaData((prev) => ({
        ...prev,
        documentImageUrls: nextList.length ? nextList : prev.documentImageUrls,
      }));
    } catch (error) {
      const message = getErrorMessage(error, "Failed to upload documents.");
      setDocumentError(message);
      setStatusDialog({ title: "Document upload failed", message });
    }
  };

  const handleRemoveDocument = async (index: number) => {
    try {
      const metaId = await ensureAccountMeta();
      if (!metaId) return;
      const nextList = accountMetaData.documentImageUrls.filter((_, idx) => idx !== index);
      setAccountMetaData((prev) => ({ ...prev, documentImageUrls: nextList }));
      await apiFetch(`/api/account-meta/${metaId}`, {
        method: "PUT",
        body: JSON.stringify({ documentImageUrls: nextList }),
      });
    } catch (error) {
      const message = getErrorMessage(error, "Failed to remove document.");
      setDocumentError(message);
      setStatusDialog({ title: "Document removal failed", message });
    }
  };

  const handleSensitiveDocumentUpload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setDocumentError(null);
    const accepted = Array.from(files).filter((file) => {
      if (file.size > MAX_DOCUMENT_SIZE_BYTES) return false;
      if (file.type && !(file.type.startsWith("image/") || file.type === "application/pdf")) return false;
      return true;
    });
    const rejected = Array.from(files).filter((file) => !accepted.includes(file));
    if (rejected.length) {
      const message = `Some files were skipped. Max size is ${MAX_DOCUMENT_SIZE_LABEL}.`;
      setDocumentError(message);
      setStatusDialog({ title: "Sensitive upload issue", message });
    }
    if (!accepted.length) return;
    try {
      const metaId = await ensureAccountMeta();
      if (!metaId) {
        const message = "Save account details before uploading sensitive documents.";
        setDocumentError(message);
        setStatusDialog({ title: "Sensitive upload issue", message });
        return;
      }
      const formData = new FormData();
      accepted.forEach((file) => formData.append("files", file));
      const result = await apiFetch<{ sensitiveDocumentImageUrls?: string[] }>(
        `/api/account-meta/${metaId}/sensitive-documents`,
        {
          method: "POST",
          body: formData,
        }
      );
      const nextList = Array.isArray(result?.sensitiveDocumentImageUrls) ? result.sensitiveDocumentImageUrls : [];
      setAccountMetaData((prev) => ({
        ...prev,
        sensitiveDocumentImageUrls: nextList.length ? nextList : prev.sensitiveDocumentImageUrls,
      }));
    } catch (error) {
      const message = getErrorMessage(error, "Failed to upload sensitive documents.");
      setDocumentError(message);
      setStatusDialog({ title: "Sensitive upload failed", message });
    }
  };

  const handleRemoveSensitiveDocument = async (index: number) => {
    try {
      const metaId = await ensureAccountMeta();
      if (!metaId) return;
      const nextList = accountMetaData.sensitiveDocumentImageUrls.filter((_, idx) => idx !== index);
      setAccountMetaData((prev) => ({ ...prev, sensitiveDocumentImageUrls: nextList }));
      await apiFetch(`/api/account-meta/${metaId}`, {
        method: "PUT",
        body: JSON.stringify({ sensitiveDocumentImageUrls: nextList }),
      });
    } catch (error) {
      const message = getErrorMessage(error, "Failed to remove sensitive document.");
      setDocumentError(message);
      setStatusDialog({ title: "Sensitive removal failed", message });
    }
  };

  const stripKeyPrefix = (value: string) => value.replace(/^local:|^gcs:/, "");
  const isInlineData = (value: string) => value.startsWith("data:");
  const isImageKey = (value: string) =>
    isInlineData(value) || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(stripKeyPrefix(value));
  const getDocumentUrl = (metaId: string, index: number, scope: "standard" | "sensitive" = "standard") =>
    `/api/account-meta/${metaId}/documents/${index}?scope=${scope}`;

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
              <Label htmlFor="bankName">Bank Name</Label>
              <Input
                id="bankName"
                value={accountMetaData.bankName}
                onChange={(e) => setAccountMetaData((prev) => ({ ...prev, bankName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountHolderName">Account Holder Name</Label>
              <Input
                id="accountHolderName"
                value={accountMetaData.accountHolderName}
                onChange={(e) => setAccountMetaData((prev) => ({ ...prev, accountHolderName: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="internationalAccountNumber">
                {isCardAccount ? "Card last 4 digits" : "IBAN"}
              </Label>
              <Input
                id="internationalAccountNumber"
                value={
                  isCardAccount
                    ? accountMetaData.cardLast4 || accountData.mask
                    : accountMetaData.internationalAccountNumber || accountData.mask
                }
                readOnly={isReadOnlyMask}
                onChange={(e) =>
                  setAccountMetaData((prev) => ({
                    ...prev,
                    internationalAccountNumber: isCardAccount ? prev.internationalAccountNumber : e.target.value,
                    cardLast4: isCardAccount ? e.target.value : prev.cardLast4,
                  }))
                }
              />
            </div>
            {(!isCardAccount ||
              accountMetaData.accountNumber ||
              accountMetaData.sortCode ||
              accountData.accountNumber ||
              accountData.sortCode) && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Account Number</Label>
                  <Input
                    id="accountNumber"
                    value={accountMetaData.accountNumber}
                    readOnly={isReadOnlyAccountNumber}
                    onChange={(e) => setAccountMetaData((prev) => ({ ...prev, accountNumber: e.target.value }))}
                    placeholder="Full account number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sortCode">Sort Code</Label>
                  <Input
                    id="sortCode"
                    value={accountMetaData.sortCode}
                    readOnly={isReadOnlySortCode}
                    onChange={(e) =>
                      setAccountMetaData((prev) => ({
                        ...prev,
                        sortCode: e.target.value.replace(/[^0-9]/g, ""),
                      }))
                    }
                    placeholder="e.g. 202728"
                  />
                </div>
              </>
            )}
          </div>
          <div className={context === "bank" ? "grid grid-cols-3 gap-4" : "grid grid-cols-4 gap-4"}>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                value={accountData.currency}
                readOnly={isReadOnlyCurrency}
                onChange={(e) => setAccountData((prev) => ({ ...prev, currency: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="balance">{balanceLabel}</Label>
              <Input
                id="balance"
                type="number"
                step="0.01"
                value={formatAmountInput(displayBalance)}
                readOnly={isReadOnlyBalance}
                onChange={(e) => setAccountData((prev) => ({ ...prev, balance: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="availableBalance">{availableLabel}</Label>
              <Input
                id="availableBalance"
                type="number"
                step="0.01"
                value={formatAmountInput(displayAvailableBalance)}
                readOnly={isReadOnlyAvailableBalance}
                onChange={(e) => setAccountData((prev) => ({ ...prev, availableBalance: Number(e.target.value) }))}
              />
            </div>
            {context !== "bank" && (
              <div className="space-y-2">
                <Label htmlFor="limit">{limitLabel}</Label>
                <Input
                  id="limit"
                  type="number"
                  step="0.01"
                  value={formatAmountInput(displayLimit)}
                  readOnly={isReadOnlyLimit}
                  onChange={(e) => setAccountData((prev) => ({ ...prev, limit: Number(e.target.value) }))}
                />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Document Images</Label>
            <div className="flex flex-wrap items-center gap-2">
              {accountMetaData.documentImageUrls.map((url, index) => (
                <div
                  key={`${url}-${index}`}
                  role="button"
                  tabIndex={0}
                  className="group relative h-12 w-12 overflow-hidden rounded-md border"
                  onClick={() => setDocumentPreview({ index, scope: "standard" })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setDocumentPreview({ index, scope: "standard" });
                    }
                  }}
                >
                  {isImageKey(url) ? (
                    <img
                      src={isInlineData(url) ? url : getDocumentUrl(accountMetaId, index)}
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
          </div>

          {isCardAccount && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="text-sm font-semibold">Statement & Payable</div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="statementBalance">Statement Balance</Label>
                  <Input
                    id="statementBalance"
                    type="number"
                    value={formatAmountInput(accountData.statementBalance)}
                    readOnly
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="statementPaidAmount">Paid so far (manual)</Label>
                  <Input
                    id="statementPaidAmount"
                    type="number"
                    value={formatAmountInput(accountData.statementPaidAmount)}
                    readOnly
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="statementDate">Statement Date</Label>
                  <Input
                    id="statementDate"
                    type="date"
                    value={statementDateInput}
                    onChange={(e) => {
                      const next = e.target.value;
                      setStatementDateInput(next);
                      setAccountData((prev) => ({ ...prev, statementDate: next }));
                      setAccountMetaData((prev) => ({
                        ...prev,
                        last3StatementDates: JSON.stringify(
                          pushDateHistory(parseDateList(prev.last3StatementDates), next)
                        ),
                      }));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="statementDueDate">Statement Due Date</Label>
                  <Input
                    id="statementDueDate"
                    type="date"
                    value={statementDueDateInput}
                    onChange={(e) => {
                      const next = e.target.value;
                      setStatementDueDateInput(next);
                      setAccountData((prev) => ({ ...prev, statementDueDate: next }));
                      setAccountMetaData((prev) => ({
                        ...prev,
                        last3DueDates: JSON.stringify(
                          pushDateHistory(parseDateList(prev.last3DueDates), next)
                        ),
                      }));
                    }}
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
                <div className="relative">
                  <Input
                    id="passphrase"
                    type={passphraseVisible ? "text" : "password"}
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="Enter passphrase"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setPassphraseVisible((prev) => !prev)}
                    aria-label={passphraseVisible ? "Hide passphrase" : "Show passphrase"}
                  >
                    {passphraseVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={secureUnlocked ? lockSensitive : handleUnlock}
                  disabled={!passphraseReady}
                >
                  {secureUnlocked ? "Lock" : "Unlock"}
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
                  <Label>Statement Password</Label>
                  <Input
                    value={secureData.statementPassword || ""}
                    onChange={(e) => setSecureData((prev) => ({ ...prev, statementPassword: e.target.value }))}
                  />
              </div>
            </div>
          )}

          <div className="rounded-lg border p-4 space-y-3">
            <div className="text-sm font-semibold">Sensitive documents</div>
            {!secureUnlocked ? (
              <p className="text-xs text-muted-foreground">
                Unlock sensitive fields to view or upload sensitive documents.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {accountMetaData.sensitiveDocumentImageUrls.map((url, index) => (
                    <div
                      key={`${url}-${index}`}
                      role="button"
                      tabIndex={0}
                      className="group relative h-12 w-12 overflow-hidden rounded-md border"
                      onClick={() => setDocumentPreview({ index, scope: "sensitive" })}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setDocumentPreview({ index, scope: "sensitive" });
                        }
                      }}
                    >
                      {isImageKey(url) ? (
                        <img
                          src={isInlineData(url) ? url : getDocumentUrl(accountMetaId, index, "sensitive")}
                          alt="Sensitive document"
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
                          void handleRemoveSensitiveDocument(index);
                        }}
                        aria-label="Remove sensitive image"
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
                      onChange={(e) => void handleSensitiveDocumentUpload(e.target.files)}
                    />
                  </label>
                </div>
              </>
            )}
          </div>
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
              {isCardAccount
                ? secureUnlocked
                  ? [
                      `Name on Card: ${secureData.nameOnCard || parseHolderName(accountMetaData.accountHolderName) || accountData.name || "—"}`,
                      `Card Number: ${secureData.fullCardNumber || "—"}`,
                      `Expiry Date: ${secureData.expiryDate || "—"}`,
                      `CVV: ${secureData.cvv || "—"}`,
                    ].join("\n")
                  : "Unlock sensitive fields to share card details."
                : [
                    `Name: ${parseHolderName(accountMetaData.accountHolderName) || accountData.name || "—"}`,
                    `Bank: ${accountMetaData.bankName || bankLabel || "—"}`,
                    `IBAN: ${accountMetaData.internationalAccountNumber || accountData.mask || "—"}`,
                    `Sort Code: ${accountMetaData.sortCode || "—"}`,
                    `Account Number: ${accountMetaData.accountNumber || "—"}`,
                    `Currency: ${accountData.currency || "—"}`,
                  ].join("\n")}
            </div>
            {isCardAccount && !secureUnlocked && (
              <div className="space-y-3 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                <div>Unlock sensitive fields to share card details.</div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    type={passphraseVisible ? "text" : "password"}
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="Enter passphrase"
                  />
                  <Button type="button" variant="outline" onClick={handleUnlock} disabled={!passphraseReady}>
                    Unlock
                  </Button>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={async () => {
                  const text = isCardAccount
                    ? [
                        `Name on Card: ${secureData.nameOnCard || parseHolderName(accountMetaData.accountHolderName) || accountData.name || "—"}`,
                        `Card Number: ${secureData.fullCardNumber || "—"}`,
                        `Expiry Date: ${secureData.expiryDate || "—"}`,
                        `CVV: ${secureData.cvv || "—"}`,
                      ].join("\n")
                    : [
                        `Name: ${parseHolderName(accountMetaData.accountHolderName) || accountData.name || "—"}`,
                        `Bank: ${accountMetaData.bankName || bankLabel || "—"}`,
                        `IBAN: ${accountMetaData.internationalAccountNumber || accountData.mask || "—"}`,
                        `Sort Code: ${accountMetaData.sortCode || "—"}`,
                        `Account Number: ${accountMetaData.accountNumber || "—"}`,
                        `Currency: ${accountData.currency || "—"}`,
                      ].join("\n");
                  await navigator.clipboard.writeText(text);
                  setCopyNoticeOpen(true);
                  setTimeout(() => setCopyNoticeOpen(false), 2000);
                }}
                disabled={isCardAccount && !secureUnlocked}
              >
                Copy details
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={documentPreview !== null} onOpenChange={() => setDocumentPreview(null)}>
          <DialogContent className="sm:max-w-[640px]">
            <DialogHeader>
              <DialogTitle>Document preview</DialogTitle>
              <DialogDescription>Preview the uploaded document.</DialogDescription>
            </DialogHeader>
            {accountMetaId && documentPreview !== null && (
              isImageKey(
                documentPreview.scope === "sensitive"
                  ? accountMetaData.sensitiveDocumentImageUrls[documentPreview.index]
                  : accountMetaData.documentImageUrls[documentPreview.index]
              ) ? (
                <img
                  src={
                    isInlineData(
                      documentPreview.scope === "sensitive"
                        ? accountMetaData.sensitiveDocumentImageUrls[documentPreview.index]
                        : accountMetaData.documentImageUrls[documentPreview.index]
                    )
                      ? documentPreview.scope === "sensitive"
                        ? accountMetaData.sensitiveDocumentImageUrls[documentPreview.index]
                        : accountMetaData.documentImageUrls[documentPreview.index]
                      : getDocumentUrl(accountMetaId, documentPreview.index, documentPreview.scope)
                  }
                  alt="Document preview"
                  className="h-auto w-full rounded-md border object-contain"
                />
              ) : (
                <iframe
                  title="Document preview"
                  src={getDocumentUrl(accountMetaId, documentPreview.index, documentPreview.scope)}
                  className="h-[70vh] w-full rounded-md border"
                />
              )
            )}
          </DialogContent>
        </Dialog>
        <Dialog open={copyNoticeOpen} onOpenChange={setCopyNoticeOpen}>
          <DialogContent className="sm:max-w-[360px]">
            <DialogHeader>
              <DialogTitle>Copied</DialogTitle>
              <DialogDescription>Account details copied to clipboard.</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
        <Dialog open={Boolean(statusDialog)} onOpenChange={(open) => (!open ? setStatusDialog(null) : null)}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>{statusDialog?.title}</DialogTitle>
              <DialogDescription>{statusDialog?.message}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStatusDialog(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <DialogFooter className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <Button variant="outline" onClick={() => setShareOpen(true)}>
            Share details
          </Button>
          <Button
            onClick={isDirty ? handleSave : () => setOpen(false)}
            disabled={saving}
          >
            {saving ? "Saving..." : isDirty ? "Save Changes" : "Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
