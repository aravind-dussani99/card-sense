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
import { Plus, X } from "lucide-react";
import { addAccountMeta } from "@/app/actions/account-meta-actions";
import { addSensitiveInfo } from "@/app/actions/sensitive-info-actions";
import { getBankAccounts } from "@/app/actions/bank-actions";
import { BankAccount } from "@/lib/types";
import { encryptPayload } from "@/lib/vault";
import { requireData } from "@/lib/api-result";
import { getApiBaseUrl } from "@/lib/api";

const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_DOCUMENT_SIZE_LABEL = "5 MB";

interface AddCardDialogProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    prefillData?: {
        last4?: string;
        bank?: string;
    };
}

export function AddCardDialog({ open: controlledOpen, onOpenChange, prefillData }: AddCardDialogProps = {} as AddCardDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
    const setOpen = onOpenChange || setInternalOpen;
    const [loading, setLoading] = useState(false);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [bankName, setBankName] = useState<string>("");
    const [accountType, setAccountType] = useState<string>("CREDIT_CARD");
    const [cardNetwork, setCardNetwork] = useState<string>("");
    const [accountHolderName, setAccountHolderName] = useState<string>("");
    const [cardImageUrl, setCardImageUrl] = useState<string>("");
    const [last3DueDates, setLast3DueDates] = useState<string[]>(["", "", ""]);
    const [last3StatementDates, setLast3StatementDates] = useState<string[]>(["", "", ""]);
    const [documentFiles, setDocumentFiles] = useState<Array<{ file: File; previewUrl?: string; label: string }>>([]);
    const [documentError, setDocumentError] = useState<string | null>(null);
    const [storeCredentials, setStoreCredentials] = useState(false);
    const [credentialsLabel, setCredentialsLabel] = useState("");
    const [credentialsPassphrase, setCredentialsPassphrase] = useState("");
    const [credentialsData, setCredentialsData] = useState({
        fullCardNumber: "",
        nameOnCard: "",
        expiryDate: "",
        cvv: "",
        pin: "",
        appPassword: "",
        memorableInfo: "",
        notes: "",
        statementPassword: "",
    });
    const isCreditCard = accountType === "CREDIT_CARD";
    const balanceLabel = isCreditCard ? "Used Balance" : "Current Balance";

    useEffect(() => {
        if (open) {
            getBankAccounts().then(setBankAccounts);
            // Prefill data if provided
            if (prefillData?.last4) {
                const form = document.querySelector('form') as HTMLFormElement;
                if (form) {
                    const last4Input = form.querySelector('[name="cardLast4"]') as HTMLInputElement;
                    if (last4Input) last4Input.value = prefillData.last4;
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

        // Calculate predicted next due date from last 3
        const validDates = last3DueDates.filter(d => d).map(d => new Date(d));
        let predictedDueDate = Number(formData.get("dueDate"));
        
        if (validDates.length >= 2) {
            // Calculate average days between due dates
            const daysBetween = [];
            for (let i = 1; i < validDates.length; i++) {
                const diff = (validDates[i].getTime() - validDates[i-1].getTime()) / (1000 * 60 * 60 * 24);
                daysBetween.push(diff);
            }
            const avgDays = daysBetween.reduce((a, b) => a + b, 0) / daysBetween.length;
            
            // Predict next due date
            if (validDates.length > 0) {
                const lastDate = validDates[validDates.length - 1];
                const nextDate = new Date(lastDate);
                nextDate.setDate(nextDate.getDate() + Math.round(avgDays));
                predictedDueDate = nextDate.getDate();
            }
        }

        const name = (formData.get("name") as string)?.trim();
        const selectedBankName = (formData.get("bankName") as string)?.trim();
        const cardLast4 = (formData.get("cardLast4") as string)?.trim();
        const currentBalance = Number(formData.get("currentBalance")) || 0;
        const limit = Number(formData.get("limit")) || 0;
        const currency = (formData.get("currency") as string)?.trim();
        const availableBalanceRaw = formData.get("availableBalance");
        const availableBalance = availableBalanceRaw === null || availableBalanceRaw === ""
            ? undefined
            : Number(availableBalanceRaw);
        const cutoffDate = Number(formData.get("cutoffDate"));

        // Validate required fields
        if (!name) {
            alert("Please enter a card name");
            setLoading(false);
            return;
        }
        if (!selectedBankName) {
            alert("Please enter a bank name");
            setLoading(false);
            return;
        }
        if (!cardNetwork) {
            alert("Please enter a card network");
            setLoading(false);
            return;
        }
        if (!cardLast4 || cardLast4.length !== 4) {
            alert("Please enter the last 4 digits of your card");
            setLoading(false);
            return;
        }

        const result = await addAccountMeta({
            label: name,
            accountType,
            accountHolderName: accountHolderName || undefined,
            bankName: selectedBankName,
            currency: currency || undefined,
            cardNetwork: cardNetwork || undefined,
            cardLast4,
            balance: currentBalance,
            availableBalance: availableBalance ?? (limit ? Math.max(0, limit - currentBalance) : undefined),
            limit,
            cardImageUrl: cardImageUrl || undefined,
            statementDay: Number.isFinite(cutoffDate) ? cutoffDate : undefined,
            dueDay: predictedDueDate || undefined,
            last3StatementDates: JSON.stringify(last3StatementDates.filter((d) => d)),
            last3DueDates: JSON.stringify(last3DueDates.filter((d) => d)),
            status: "active",
        });
        setLoading(false);

        if (result.success) {
            const savedCard = requireData(result, "Card saved, but document upload was skipped due to missing card id.");
            if (documentFiles.length) {
                try {
                    const formData = new FormData();
                    documentFiles.forEach(({ file }) => formData.append("files", file));
                    const response = await fetch(`${getApiBaseUrl()}/api/account-meta/${savedCard.id}/documents`, {
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
                    alert("Card saved, but documents could not be uploaded.");
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
                        accountMetaId: savedCard.id,
                        encryptedPayload: payload,
                    });
                } catch (error) {
                    console.error("Failed to store card credentials:", error);
                    alert("Card saved, but credentials could not be stored.");
                }
            }
            setOpen(false);
            setBankName("");
            setAccountHolderName("");
            setCardImageUrl("");
            setCardNetwork("");
            setLast3DueDates(["", "", ""]);
            setLast3StatementDates(["", "", ""]);
            documentFiles.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
            setDocumentFiles([]);
            setDocumentError(null);
            setStoreCredentials(false);
            setCredentialsLabel("");
            setCredentialsPassphrase("");
            setCredentialsData({
                fullCardNumber: "",
                nameOnCard: "",
                expiryDate: "",
                cvv: "",
                pin: "",
                appPassword: "",
                memorableInfo: "",
                notes: "",
                statementPassword: "",
            });
            (e.target as HTMLFormElement).reset();
            // Refresh the page to show new card
            window.location.reload();
        } else {
            alert(result.error || "Failed to add card. Please check the console for details.");
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {controlledOpen === undefined && (
                <DialogTrigger asChild>
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Add Card
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[600px] bg-white">
                <DialogHeader>
                    <DialogTitle>Add New Card</DialogTitle>
                    <DialogDescription>
                        Enter the details of your credit card here.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        {/* Row 1: Card Name and Account Type */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Card Name</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    placeholder="e.g. Sapphire Reserve"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="accountType">Account Type</Label>
                                <Select value={accountType} onValueChange={setAccountType} required>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select card type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {["CREDIT_CARD", "DEBIT_CARD", "CASH_CARD"].map((value) => (
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
                                    value={accountHolderName}
                                    onChange={(e) => setAccountHolderName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="bankName">Bank Name</Label>
                                <Input
                                    id="bankName"
                                    name="bankName"
                                    list="card-bank-name-options"
                                    placeholder="e.g. Barclays"
                                    value={bankName}
                                    onChange={(e) => setBankName(e.target.value)}
                                    required
                                />
                                <datalist id="card-bank-name-options">
                                    {bankNameOptions.map((name) => (
                                        <option key={name} value={name} />
                                    ))}
                                </datalist>
                            </div>
                        </div>

                        {/* Row 2: International Account Number + Card Network */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="cardLast4">Card last 4 digits</Label>
                                <Input
                                    id="cardLast4"
                                    name="cardLast4"
                                    placeholder="e.g. 5009"
                                    maxLength={4}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cardNetwork">Card Network</Label>
                                <Input
                                    id="cardNetwork"
                                    name="cardNetwork"
                                    placeholder="e.g. Visa"
                                    value={cardNetwork}
                                    onChange={(e) => setCardNetwork(e.target.value)}
                                    required
                                />
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
                                    min="0"
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
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="limit">Limit</Label>
                                <Input
                                    id="limit"
                                    name="limit"
                                    type="number"
                                    placeholder="10000"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cardImageUrl">Card Image URL</Label>
                                <Input
                                    id="cardImageUrl"
                                    name="cardImageUrl"
                                    placeholder="https://..."
                                    value={cardImageUrl}
                                    onChange={(e) => setCardImageUrl(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Row 4: Statement Day and Due Day */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="cutoffDate">Statement Day</Label>
                                <Input
                                    id="cutoffDate"
                                    name="cutoffDate"
                                    type="number"
                                    min="1"
                                    max="31"
                                    placeholder="15"
                                    required
                                />
                                <p className="text-xs text-muted-foreground">Day of month billing cycle ends</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="dueDate">Due Day</Label>
                                <Input
                                    id="dueDate"
                                    name="dueDate"
                                    type="number"
                                    min="1"
                                    max="31"
                                    placeholder="10"
                                    required
                                />
                                <p className="text-xs text-muted-foreground">Day of month payment is due</p>
                            </div>
                        </div>

                        {/* Row 5: Last 3 Statement Dates */}
                        <div className="space-y-2">
                            <Label>Last 3 Statement Dates</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {[0, 1, 2].map((index) => (
                                    <Input
                                        key={index}
                                        type="date"
                                        placeholder={`Date ${index + 1}`}
                                        value={last3StatementDates[index]}
                                        onChange={(e) => {
                                            const newDates = [...last3StatementDates];
                                            newDates[index] = e.target.value;
                                            setLast3StatementDates(newDates);
                                        }}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Row 6: Last 3 Due Dates */}
                        <div className="space-y-2">
                            <Label>Last 3 Due Dates (for prediction)</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {[0, 1, 2].map((index) => (
                                    <Input
                                        key={index}
                                        type="date"
                                        placeholder={`Date ${index + 1}`}
                                        value={last3DueDates[index]}
                                        onChange={(e) => {
                                            const newDates = [...last3DueDates];
                                            newDates[index] = e.target.value;
                                            setLast3DueDates(newDates);
                                        }}
                                    />
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Enter last 3 due dates to help predict future due dates
                            </p>
                        </div>

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

                        {/* Row 7: Statement Password */}
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
                                Store card credentials (encrypted)
                            </label>
                            {storeCredentials && (
                                <div className="grid gap-3">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Credential Label</Label>
                                            <Input
                                                value={credentialsLabel}
                                                onChange={(e) => setCredentialsLabel(e.target.value)}
                                                placeholder="e.g. Personal Visa"
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
                                            <Label>Full Card Number</Label>
                                            <Input
                                                value={credentialsData.fullCardNumber}
                                                onChange={(e) =>
                                                    setCredentialsData((prev) => ({ ...prev, fullCardNumber: e.target.value }))
                                                }
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Name on Card</Label>
                                            <Input
                                                value={credentialsData.nameOnCard}
                                                onChange={(e) => setCredentialsData((prev) => ({ ...prev, nameOnCard: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <Label>Expiry Date</Label>
                                            <Input
                                                value={credentialsData.expiryDate}
                                                onChange={(e) => setCredentialsData((prev) => ({ ...prev, expiryDate: e.target.value }))}
                                                placeholder="MM/YY"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>CVV</Label>
                                            <Input
                                                value={credentialsData.cvv}
                                                onChange={(e) => setCredentialsData((prev) => ({ ...prev, cvv: e.target.value }))}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>PIN</Label>
                                            <Input
                                                value={credentialsData.pin}
                                                onChange={(e) => setCredentialsData((prev) => ({ ...prev, pin: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>App Password/Passphrase</Label>
                                            <Input
                                                value={credentialsData.appPassword}
                                                onChange={(e) => setCredentialsData((prev) => ({ ...prev, appPassword: e.target.value }))}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Memorable Info</Label>
                                            <Input
                                                value={credentialsData.memorableInfo}
                                                onChange={(e) => setCredentialsData((prev) => ({ ...prev, memorableInfo: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Notes</Label>
                                        <Input
                                            value={credentialsData.notes}
                                            onChange={(e) => setCredentialsData((prev) => ({ ...prev, notes: e.target.value }))}
                                        />
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
                            {loading ? "Adding..." : "Add Card"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
