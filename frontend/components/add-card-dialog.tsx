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
import { Plus } from "lucide-react";
import { addCard } from "@/app/actions/card-actions";
import { getBanks } from "@/app/actions/bank-actions";
import { getCardTypes } from "@/app/actions/card-type-actions";
import { Bank, CardType } from "@/lib/types";
import { createCardCredential } from "@/app/actions/credential-actions";
import { encryptPayload } from "@/lib/vault";
import { requireData } from "@/lib/api-result";

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
    const [banks, setBanks] = useState<Bank[]>([]);
    const [cardTypes, setCardTypes] = useState<CardType[]>([]);
    const [selectedBank, setSelectedBank] = useState<string>("");
    const [selectedCardType, setSelectedCardType] = useState<string>("");
    const [last3DueDates, setLast3DueDates] = useState<string[]>(["", "", ""]);
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
    });

    useEffect(() => {
        if (open) {
            getBanks().then(setBanks);
            getCardTypes().then(setCardTypes);
            // Prefill data if provided
            if (prefillData?.last4) {
                const form = document.querySelector('form') as HTMLFormElement;
                if (form) {
                    const last4Input = form.querySelector('[name="last4"]') as HTMLInputElement;
                    if (last4Input) last4Input.value = prefillData.last4;
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
        const bank = selectedBankData?.name;
        const last4 = (formData.get("last4") as string)?.trim();
        const currentBalance = Number(formData.get("currentBalance")) || 0;

        // Validate required fields
        if (!name) {
            alert("Please enter a card name");
            setLoading(false);
            return;
        }
        if (!selectedBank) {
            alert("Please select a bank");
            setLoading(false);
            return;
        }
        if (!selectedCardType) {
            alert("Please select a card type (network)");
            setLoading(false);
            return;
        }
        if (!last4 || last4.length !== 4) {
            alert("Please enter the last 4 digits of your card");
            setLoading(false);
            return;
        }

        const data = {
            name,
            bank: bank || "",
            bankId: selectedBank || undefined,
            cardTypeId: selectedCardType || undefined,
            last4,
            limit: Number(formData.get("limit")),
            balance: currentBalance,
            cutoffDate: Number(formData.get("cutoffDate")),
            dueDate: predictedDueDate,
            last3DueDates: JSON.stringify(last3DueDates.filter(d => d)),
            statementPassword: (formData.get("statementPassword") as string)?.trim() || undefined,
            color: "bg-blue-900", // Default color for now
        };

        const result = await addCard(data);
        setLoading(false);

        if (result.success) {
            if (storeCredentials) {
                if (!credentialsPassphrase) {
                    alert("Enter a vault passphrase to encrypt credentials.");
                    return;
                }
                try {
                    const savedCard = requireData(result, "Card saved, but credential storage was skipped due to missing card id.");
                    const payload = await encryptPayload(credentialsPassphrase, {
                        ...credentialsData,
                        label: credentialsLabel || name,
                    });
                    await createCardCredential(savedCard.id, payload, credentialsLabel || name);
                } catch (error) {
                    console.error("Failed to store card credentials:", error);
                    alert("Card saved, but credentials could not be stored.");
                }
            }
            setOpen(false);
            setSelectedBank("");
            setSelectedCardType("");
            setLast3DueDates(["", "", ""]);
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
                        {/* Row 1: Card Name and Bank */}
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

                        {/* Row 2: Card Type and Last 4 */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="cardType">Card Type</Label>
                                <Select value={selectedCardType} onValueChange={setSelectedCardType} required>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select card type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {cardTypes.length === 0 ? (
                                            <SelectItem value="no-types" disabled>No card types available. Add one in Reference Data.</SelectItem>
                                        ) : (
                                            cardTypes.map((ct) => (
                                                <SelectItem key={ct.id} value={ct.id}>
                                                    {ct.name}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="last4">Last 4 Digits</Label>
                                <Input
                                    id="last4"
                                    name="last4"
                                    placeholder="1234"
                                    maxLength={4}
                                    required
                                />
                            </div>
                        </div>

                        {/* Row 3: Limit and Current Balance */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="limit">Credit Limit</Label>
                                <Input
                                    id="limit"
                                    name="limit"
                                    type="number"
                                    placeholder="10000"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="currentBalance">Current Balance</Label>
                                <Input
                                    id="currentBalance"
                                    name="currentBalance"
                                    type="number"
                                    placeholder="0"
                                    defaultValue="0"
                                    min="0"
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

                        {/* Row 5: Last 3 Due Dates */}
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

                        {/* Row 6: Statement Password */}
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
