"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Plus, X } from "lucide-react";
import { getBankAccounts } from "@/app/actions/bank-actions";
import { addAccountMeta } from "@/app/actions/account-meta-actions";
import { addSensitiveInfo } from "@/app/actions/sensitive-info-actions";
import { encryptPayload } from "@/lib/vault";
import { requireData } from "@/lib/api-result";
import { BankAccount } from "@/lib/types";
import { getApiBaseUrl } from "@/lib/api";

const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_DOCUMENT_SIZE_LABEL = "5 MB";

interface AddAccountDialogProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    prefillData?: {
        accountNumber?: string;
        bank?: string;
    };
}

export function AddAccountDialog({ open: controlledOpen, onOpenChange, prefillData }: AddAccountDialogProps = {} as AddAccountDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
    const setOpen = onOpenChange || setInternalOpen;
    const [loading, setLoading] = useState(false);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [bankName, setBankName] = useState<string>("");
    const [accountType, setAccountType] = useState<string>("BANK_ACCOUNT");
    const [documentFiles, setDocumentFiles] = useState<Array<{ file: File; previewUrl?: string; label: string }>>([]);
    const [documentError, setDocumentError] = useState<string | null>(null);
    const [storeCredentials, setStoreCredentials] = useState(false);
    const [credentialsLabel, setCredentialsLabel] = useState("");
    const [credentialsPassphrase, setCredentialsPassphrase] = useState("");
    const [credentialsData, setCredentialsData] = useState({
        username: "",
        customerName: "",
        password: "",
        passphrase: "",
        memorableInfo: "",
        statementPassword: "",
    });
    const isOverdraftAccount = accountType === "OVERDRAFT";
    const balanceLabel = isOverdraftAccount ? "Used Balance" : "Current Balance";
    const limitLabel = isOverdraftAccount ? "Overdraft Limit" : "Limit";

    useEffect(() => {
        if (open) {
            getBankAccounts().then(setBankAccounts);
            // Prefill data if provided
            if (prefillData?.accountNumber) {
                const form = document.querySelector('form') as HTMLFormElement;
                if (form) {
                    const accountInput = form.querySelector('[name="accountNumber"]') as HTMLInputElement;
                    if (accountInput) accountInput.value = prefillData.accountNumber;
                }
            }
            if (prefillData?.bank) {
                setBankName(prefillData.bank);
            }
            setDocumentError(null);
        }
    }, [open, prefillData]);

    const bankNameOptions = Array.from(
        new Set(
            bankAccounts
                .map((account) => {
                    if (account.connection?.institutionId) return account.connection.institutionId;
                    if (account.tags?.startsWith("bank:")) return account.tags.replace("bank:", "");
                    return account.name || "";
                })
                .map((value) => value.trim())
                .filter(Boolean)
        )
    ).sort((a, b) => a.localeCompare(b));

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.currentTarget);

        const name = (formData.get("name") as string)?.trim();
        const accountHolderName = (formData.get("accountHolderName") as string)?.trim();
        const selectedBankName = (formData.get("bankName") as string)?.trim();
        const accountNumber = (formData.get("accountNumber") as string)?.trim();
        const sortCode = (formData.get("sortCode") as string)?.trim();
        const currency = (formData.get("currency") as string)?.trim();
        const limit = Number(formData.get("limit") || 0);
        const currentBalance = Number(formData.get("currentBalance") || 0);
        const availableBalanceRaw = formData.get("availableBalance");
        const availableBalance = availableBalanceRaw === null || availableBalanceRaw === ""
            ? currentBalance
            : Number(availableBalanceRaw);
        const internationalAccountNumber = (formData.get("internationalAccountNumber") as string)?.trim();

        // Validate required fields
        if (!name) {
            alert("Please enter an account name");
            setLoading(false);
            return;
        }
        if (!selectedBankName) {
            alert("Please enter a bank name");
            setLoading(false);
            return;
        }
        if (!accountNumber || accountNumber.length < 4) {
            alert("Please enter at least the last 4 digits of your account number");
            setLoading(false);
            return;
        }
        if (sortCode && sortCode.replace(/[^0-9]/g, "").length < 6) {
            alert("Please enter a 6 digit sort code");
            setLoading(false);
            return;
        }

        const result = await addAccountMeta({
            label: name,
            accountType,
            accountHolderName: accountHolderName || undefined,
            bankName: selectedBankName,
            accountNumber,
            internationalAccountNumber: internationalAccountNumber || undefined,
            sortCode: sortCode ? sortCode.replace(/[^0-9]/g, "") : undefined,
            currency: currency || undefined,
            balance: currentBalance,
            availableBalance,
            limit,
            status: "active",
        });
        setLoading(false);

        if (result.success) {
            const account = requireData(result, "Account saved, but follow-up steps were skipped due to missing account id.");
            if (documentFiles.length) {
                try {
                    const formData = new FormData();
                    documentFiles.forEach(({ file }) => formData.append("files", file));
                    const response = await fetch(`${getApiBaseUrl()}/api/account-meta/${account.id}/documents`, {
                        method: "POST",
                        body: formData,
                    });
                    if (!response.ok) {
                        const message = await response.text();
                        throw new Error(message || "Failed to upload documents");
                    }
                    await response.json();
                } catch (error) {
                    console.error("Failed to upload documents:", error);
                    alert("Account saved, but documents could not be uploaded.");
                }
            }
            if (storeCredentials) {
                if (!credentialsPassphrase) {
                    alert("Enter a vault passphrase to encrypt credentials.");
                    return;
                }
                try {
                    const payload = await encryptPayload(credentialsPassphrase, {
                        ...credentialsData,
                        label: credentialsLabel || name,
                    });
                    await addSensitiveInfo({
                        accountMetaId: account.id,
                        encryptedPayload: payload,
                    });
                } catch (error) {
                    console.error("Failed to store account credentials:", error);
                    alert("Account saved, but credentials could not be stored.");
                }
            }
            setOpen(false);
            setBankName("");
            documentFiles.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
            setDocumentFiles([]);
            setDocumentError(null);
            setStoreCredentials(false);
            setCredentialsLabel("");
            setCredentialsPassphrase("");
            setCredentialsData({
                username: "",
                customerName: "",
                password: "",
                passphrase: "",
                memorableInfo: "",
                statementPassword: "",
            });
            (e.target as HTMLFormElement).reset();
            // Refresh the page to show new account
            window.location.reload();
        } else {
            alert(result.error || "Failed to add account. Please check the console for details.");
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {controlledOpen === undefined && (
                <DialogTrigger asChild>
                    <Button variant="outline">
                        <Building2 className="mr-2 h-4 w-4" /> Add Account
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[600px] bg-white">
                <DialogHeader>
                    <DialogTitle>Add New Bank Account</DialogTitle>
                    <DialogDescription>
                        Enter the details of your bank account here.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        {/* Row 1: Account Name and Account Type */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Account Name</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    placeholder="e.g. Savings Account"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="accountType">Account Type</Label>
                                <Select value={accountType} onValueChange={setAccountType} required>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select account type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {["BANK_ACCOUNT", "OVERDRAFT", "CASH_ACCOUNT", "OTHER"].map((value) => (
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
                                <Label htmlFor="accountHolderName">Account Holder Name</Label>
                                <Input
                                    id="accountHolderName"
                                    name="accountHolderName"
                                    placeholder="e.g. Aravind Reddy"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="bankName">Bank Name</Label>
                                <Input
                                    id="bankName"
                                    name="bankName"
                                    list="bank-name-options"
                                    placeholder="e.g. Barclays"
                                    value={bankName}
                                    onChange={(e) => setBankName(e.target.value)}
                                    required
                                />
                                <datalist id="bank-name-options">
                                    {bankNameOptions.map((name) => (
                                        <option key={name} value={name} />
                                    ))}
                                </datalist>
                            </div>
                        </div>

                        {/* Row 2: International Account Number + Account Number */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="internationalAccountNumber">International bank account number (IBAN)</Label>
                                <Input
                                    id="internationalAccountNumber"
                                    name="internationalAccountNumber"
                                    placeholder="e.g. GB94BUKB20272883700909"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="accountNumber">Account Number</Label>
                                <Input
                                    id="accountNumber"
                                    name="accountNumber"
                                    placeholder="Enter account number"
                                    required
                                />
                                <p className="text-xs text-muted-foreground">
                                    Enter full account number or at least last 4 digits
                                </p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="sortCode">Sort Code (UK)</Label>
                                <Input
                                    id="sortCode"
                                    name="sortCode"
                                    placeholder="e.g. 20-27-28"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Optional, 6 digits for UK bank accounts
                                </p>
                            </div>
                        </div>

                        {/* Row 3: Currency + Balances */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="currency">Currency</Label>
                                <Input
                                    id="currency"
                                    name="currency"
                                    placeholder="e.g. GBP"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="currentBalance">{balanceLabel}</Label>
                                <Input
                                    id="currentBalance"
                                    name="currentBalance"
                                    type="number"
                                    placeholder="0"
                                    defaultValue="0"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="availableBalance">Available Balance</Label>
                                <Input
                                    id="availableBalance"
                                    name="availableBalance"
                                    type="number"
                                    placeholder="0"
                                />
                            </div>
                        </div>
                        {accountType !== "BANK_ACCOUNT" && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="limit">{limitLabel}</Label>
                                    <Input
                                        id="limit"
                                        name="limit"
                                        type="number"
                                        placeholder="0"
                                        defaultValue="0"
                                        min="0"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Document Images</Label>
                            <div className="flex flex-wrap items-center gap-2">
                                {documentFiles.map(({ previewUrl, label }, index) => (
                                    <div key={`${label}-${index}`} className="group relative h-12 w-12 overflow-hidden rounded-md border">
                                        {previewUrl ? (
                                            <img src={previewUrl} alt="Document" className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center bg-slate-50 text-[10px] font-semibold text-slate-500">
                                                {label}
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-xs opacity-0 shadow-sm transition group-hover:opacity-100"
                                            onClick={() =>
                                                setDocumentFiles((prev) => {
                                                    const next = [...prev];
                                                    const removed = next.splice(index, 1);
                                                    if (removed[0]?.previewUrl) URL.revokeObjectURL(removed[0].previewUrl);
                                                    return next;
                                                })
                                            }
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
                                        onChange={(e) => {
                                            const files = e.target.files;
                                            if (!files || !files.length) return;
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
                                            const next = accepted.map((file) => {
                                                const isImage = file.type.startsWith("image/");
                                                const previewUrl = isImage ? URL.createObjectURL(file) : undefined;
                                                const extension = file.name.split(".").pop() || "FILE";
                                                return {
                                                    file,
                                                    previewUrl,
                                                    label: isImage ? "IMG" : extension.toUpperCase(),
                                                };
                                            });
                                            setDocumentFiles((prev) => [...prev, ...next]);
                                        }}
                                    />
                                </label>
                            </div>
                            {documentError && <p className="text-xs text-red-600">{documentError}</p>}
                        </div>

                        {/* Statement Password */}
                        <div className="space-y-2">
                            <Label htmlFor="statementPassword">Statement Password (Optional)</Label>
                            <Input
                                id="statementPassword"
                                name="statementPassword"
                                type="password"
                                placeholder="Password for encrypted PDF statements"
                                value={credentialsData.statementPassword}
                                onChange={(e) =>
                                    setCredentialsData((prev) => ({ ...prev, statementPassword: e.target.value }))
                                }
                            />
                            <p className="text-xs text-muted-foreground">
                                Enter password if your bank statements are password-protected
                            </p>
                        </div>

                        <div className="space-y-3 border-t pt-4">
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={storeCredentials}
                                    onChange={(e) => setStoreCredentials(e.target.checked)}
                                />
                                Store internet banking credentials (encrypted)
                            </label>
                            {storeCredentials && (
                                <div className="grid gap-3">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Credential Label</Label>
                                            <Input
                                                value={credentialsLabel}
                                                onChange={(e) => setCredentialsLabel(e.target.value)}
                                                placeholder="e.g. Main Checking"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Vault Passphrase</Label>
                                            <Input
                                                type="password"
                                                value={credentialsPassphrase}
                                                onChange={(e) => setCredentialsPassphrase(e.target.value)}
                                                placeholder="Passphrase for encryption"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Username</Label>
                                            <Input
                                                value={credentialsData.username}
                                                onChange={(e) =>
                                                    setCredentialsData((prev) => ({ ...prev, username: e.target.value }))
                                                }
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Customer Name</Label>
                                            <Input
                                                value={credentialsData.customerName}
                                                onChange={(e) =>
                                                    setCredentialsData((prev) => ({ ...prev, customerName: e.target.value }))
                                                }
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Password</Label>
                                            <Input
                                                value={credentialsData.password}
                                                onChange={(e) => setCredentialsData((prev) => ({ ...prev, password: e.target.value }))}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Passphrase</Label>
                                            <Input
                                                value={credentialsData.passphrase}
                                                onChange={(e) =>
                                                    setCredentialsData((prev) => ({ ...prev, passphrase: e.target.value }))
                                                }
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Memorable Info</Label>
                                            <Input
                                                value={credentialsData.memorableInfo}
                                                onChange={(e) =>
                                                    setCredentialsData((prev) => ({ ...prev, memorableInfo: e.target.value }))
                                                }
                                            />
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Credentials are encrypted in the browser before saving.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Adding..." : "Add Account"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
