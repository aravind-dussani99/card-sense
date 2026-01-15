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
import { Plus, Building2 } from "lucide-react";
import { getBanks, addBankAccount } from "@/app/actions/bank-actions";
import { createBankAccountCredential } from "@/app/actions/credential-actions";
import { encryptPayload } from "@/lib/vault";

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
    const [banks, setBanks] = useState<any[]>([]);
    const [selectedBank, setSelectedBank] = useState<string>("");
    const [storeCredentials, setStoreCredentials] = useState(false);
    const [credentialsLabel, setCredentialsLabel] = useState("");
    const [credentialsPassphrase, setCredentialsPassphrase] = useState("");
    const [credentialsData, setCredentialsData] = useState({
        username: "",
        customerName: "",
        password: "",
        passphrase: "",
        memorableInfo: "",
        authDetails: "",
    });

    useEffect(() => {
        if (open) {
            getBanks().then(setBanks);
            // Prefill data if provided
            if (prefillData?.accountNumber) {
                const form = document.querySelector('form') as HTMLFormElement;
                if (form) {
                    const accountInput = form.querySelector('[name="accountNumber"]') as HTMLInputElement;
                    if (accountInput) accountInput.value = prefillData.accountNumber;
                }
            }
            if (prefillData?.bank) {
                // Find and select the bank
                getBanks().then(bankList => {
                    const bank = bankList.find(b => b.name.toLowerCase().includes(prefillData!.bank!.toLowerCase()));
                    if (bank) setSelectedBank(bank.id);
                });
            }
        }
    }, [open, prefillData]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.currentTarget);

        const selectedBankData = banks.find(b => b.id === selectedBank);
        const name = (formData.get("name") as string)?.trim();
        const accountNumber = (formData.get("accountNumber") as string)?.trim();
        const limit = Number(formData.get("limit") || 0);
        const currentBalance = Number(formData.get("currentBalance") || 0);

        // Validate required fields
        if (!name) {
            alert("Please enter an account name");
            setLoading(false);
            return;
        }
        if (!selectedBank) {
            alert("Please select a bank");
            setLoading(false);
            return;
        }
        if (!accountNumber || accountNumber.length < 4) {
            alert("Please enter at least the last 4 digits of your account number");
            setLoading(false);
            return;
        }

        // Use last 4 digits of account number
        const last4 = accountNumber.slice(-4);

        const result = await addBankAccount({
            name,
            type: "account",
            bankName: selectedBankData?.name || "",
            mask: last4,
            currency: "USD",
            balance: currentBalance,
            availableBalance: currentBalance,
            limit,
        });
        setLoading(false);

        if (result.success) {
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
                    await createBankAccountCredential(result.data.id, payload, credentialsLabel || name);
                } catch (error) {
                    console.error("Failed to store account credentials:", error);
                    alert("Account saved, but credentials could not be stored.");
                }
            }
            setOpen(false);
            setSelectedBank("");
            setStoreCredentials(false);
            setCredentialsLabel("");
            setCredentialsPassphrase("");
            setCredentialsData({
                username: "",
                customerName: "",
                password: "",
                passphrase: "",
                memorableInfo: "",
                authDetails: "",
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
                        {/* Row 1: Account Name and Bank */}
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
                                <Label htmlFor="bank">Bank</Label>
                                <Select value={selectedBank} onValueChange={setSelectedBank} required>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select bank" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {banks.length === 0 ? (
                                            <SelectItem value="no-banks" disabled>No banks available. Seed the backend reference data first.</SelectItem>
                                        ) : (
                                            banks.map((bank) => (
                                                <SelectItem key={bank.id} value={bank.id}>
                                                    {bank.name}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Row 2: Account Number */}
                        <div className="space-y-2">
                            <Label htmlFor="accountNumber">Account Number (Last 4 digits minimum)</Label>
                            <Input
                                id="accountNumber"
                                name="accountNumber"
                                placeholder="Enter account number (last 4 will be used)"
                                required
                            />
                            <p className="text-xs text-muted-foreground">
                                Enter full account number or at least last 4 digits
                            </p>
                        </div>

                        {/* Row 3: Balance Limit and Current Balance */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="limit">Account Limit (Optional)</Label>
                                <Input
                                    id="limit"
                                    name="limit"
                                    type="number"
                                    placeholder="0"
                                    defaultValue="0"
                                    min="0"
                                />
                                <p className="text-xs text-muted-foreground">Maximum balance limit if applicable</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="currentBalance">Current Balance</Label>
                                <Input
                                    id="currentBalance"
                                    name="currentBalance"
                                    type="number"
                                    placeholder="0"
                                    defaultValue="0"
                                />
                            </div>
                        </div>

                        {/* Statement Password */}
                        <div className="space-y-2">
                            <Label htmlFor="statementPassword">Statement Password (Optional)</Label>
                            <Input
                                id="statementPassword"
                                name="statementPassword"
                                type="password"
                                placeholder="Password for encrypted PDF statements"
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
                                        <div className="space-y-2">
                                            <Label>Auth Details</Label>
                                            <Input
                                                value={credentialsData.authDetails}
                                                onChange={(e) =>
                                                    setCredentialsData((prev) => ({ ...prev, authDetails: e.target.value }))
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
