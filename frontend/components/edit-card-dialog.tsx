"use client";

import { useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Trash2 } from "lucide-react";
import { updateCard, deleteCard, type CardFormData } from "@/app/actions/card-actions";
import { getCardTypes } from "@/app/actions/card-type-actions";
import { getBanks } from "@/app/actions/bank-actions";
import { createCardCredential } from "@/app/actions/credential-actions";
import { apiFetch } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { decryptPayload, encryptPayload, passphraseMarkerExists } from "@/lib/vault";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Bank, CardType } from "@/lib/types";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface EditCardDialogProps {
    card: {
        id: string;
        name: string;
        nameOnCard?: string | null;
        bank: string;
        bankId?: string | null;
        last4: string;
        fullCardNumber?: string | null;
        expiryDate?: string | null;
        cvv?: string | null;
        cardTypeId?: string | null;
        cardType?: { id: string; name: string } | null;
        limit: number;
        balance?: number;
        cutoffDate: number;
        dueDate: number;
        color: string;
        statementPassword?: string | null;
    };
    triggerVariant?: "default" | "icon";
}

type CardSensitiveData = {
    label?: string;
    fullCardNumber?: string;
    nameOnCard?: string;
    expiryDate?: string;
    cvv?: string;
    pin?: string;
    appPassword?: string;
    passphrase?: string;
    memorableInfo?: string;
    notes?: string;
    statementPassword?: string;
};

type CredentialRecord = {
    encryptedPayload?: string | null;
};

export function EditCardDialog({ card, triggerVariant = "default" }: EditCardDialogProps) {
    const [open, setOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [passphraseReady, setPassphraseReady] = useState(false);
    const [passphrase, setPassphrase] = useState("");
    const [secureUnlocked, setSecureUnlocked] = useState(false);
    const [secureError, setSecureError] = useState<string | null>(null);
    const [secureData, setSecureData] = useState<CardSensitiveData>({});
    const [cardTypes, setCardTypes] = useState<CardType[]>([]);
    const [banks, setBanks] = useState<Bank[]>([]);
    const [selectedCardType, setSelectedCardType] = useState<string>(card.cardTypeId || "");
    const [selectedBank, setSelectedBank] = useState<string>("");
    const [formData, setFormData] = useState({
        name: card.name,
        last4: card.last4,
        limit: card.limit.toString(),
        balance: (card.balance || 0).toString(),
        cutoffDate: card.cutoffDate.toString(),
        dueDate: card.dueDate.toString(),
        color: card.color,
    });

    const loadReferenceData = async () => {
        const [cardTypeData, bankData] = await Promise.all([getCardTypes(), getBanks()]);
        setCardTypes(cardTypeData);
        setBanks(bankData);
        const matchingBank = bankData.find((bank) => bank.name === card.bank);
        if (matchingBank) {
            setSelectedBank(matchingBank.id);
        }
    };

    const resetFormState = () => {
        setSelectedCardType(card.cardTypeId || "");
        setFormData({
            name: card.name,
            last4: card.last4,
            limit: card.limit.toString(),
            balance: (card.balance || 0).toString(),
            cutoffDate: card.cutoffDate.toString(),
            dueDate: card.dueDate.toString(),
            color: card.color,
        });
        setPassphraseReady(passphraseMarkerExists());
        setPassphrase("");
        setSecureUnlocked(false);
        setSecureError(null);
        setSecureData({});
    };

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen);
        if (nextOpen) {
            void loadReferenceData();
            resetFormState();
        }
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
            const payloads = await apiFetch<CredentialRecord[]>(
                `/api/credentials/cards?cardId=${encodeURIComponent(card.id)}&includePayload=true`
            );
            const payload = payloads?.[0]?.encryptedPayload;
            if (payload) {
                const decrypted = await decryptPayload(passphrase, payload);
                setSecureData({
                    label: decrypted.label,
                    fullCardNumber: decrypted.fullCardNumber,
                    nameOnCard: decrypted.nameOnCard,
                    expiryDate: decrypted.expiryDate,
                    cvv: decrypted.cvv,
                    pin: decrypted.pin,
                    appPassword: decrypted.appPassword,
                    passphrase: decrypted.passphrase,
                    memorableInfo: decrypted.memorableInfo,
                    notes: decrypted.notes,
                    statementPassword: decrypted.statementPassword,
                });
            } else {
                setSecureData({
                    nameOnCard: card.nameOnCard || "",
                    fullCardNumber: card.fullCardNumber || "",
                    expiryDate: card.expiryDate || "",
                    cvv: card.cvv || "",
                    statementPassword: card.statementPassword || "",
                });
            }
            setSecureUnlocked(true);
        } catch (error) {
            setSecureError(getErrorMessage(error, "Failed to decrypt sensitive fields."));
            setSecureUnlocked(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setSecureError(null);

        const selectedBankData = banks.find((bank) => bank.id === selectedBank);
        const bankName = selectedBankData?.name || card.bank;

        const data: CardFormData = {
            name: formData.name,
            bank: bankName,
            bankId: selectedBank || undefined,
            last4: formData.last4,
            cardTypeId: selectedCardType || undefined,
            limit: Number(formData.limit),
            balance: Number(formData.balance) || 0,
            cutoffDate: Number(formData.cutoffDate),
            dueDate: Number(formData.dueDate),
            color: formData.color,
        };

        if (secureUnlocked) {
            if (secureData.nameOnCard !== undefined) data.nameOnCard = secureData.nameOnCard || undefined;
            if (secureData.statementPassword !== undefined) {
                data.statementPassword = secureData.statementPassword || undefined;
            }
        }

        const result = await updateCard(card.id, data);

        if (!result.success) {
            setLoading(false);
            setSecureError(result.error || "Failed to update card");
            return;
        }

        if (secureUnlocked && passphrase) {
            try {
                const payload = await encryptPayload(passphrase, {
                    ...secureData,
                    label: secureData.label || card.name,
                });
                await createCardCredential(card.id, payload, secureData.label || card.name);
            } catch (error) {
                setSecureError(getErrorMessage(error, "Card saved, but sensitive fields could not be updated."));
                setLoading(false);
                return;
            }
        }

        setLoading(false);
        setOpen(false);
    };

    const handleDelete = async () => {
        setLoading(true);
        const result = await deleteCard(card.id);
        setLoading(false);

        if (result.success) {
            setDeleteOpen(false);
            setOpen(false);
        } else {
            alert("Failed to delete card");
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={handleOpenChange}>
                {triggerVariant === "icon" ? (
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-full"
                        aria-label="View card"
                        onClick={() => handleOpenChange(true)}
                    >
                        <Eye className="h-4 w-4" />
                    </Button>
                ) : (
                    <Button variant="outline" size="sm" onClick={() => handleOpenChange(true)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View
                    </Button>
                )}
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>View & Edit Card</DialogTitle>
                        <DialogDescription>
                            Review and update the details of your credit card.
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
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                                                <SelectItem value="no-banks" disabled>No banks available. Add one in Reference Data.</SelectItem>
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
                                                <SelectItem value="no-types" disabled>No card types available</SelectItem>
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
                                        value={formData.last4}
                                        onChange={(e) => setFormData({ ...formData, last4: e.target.value })}
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
                                        value={formData.limit}
                                        onChange={(e) => setFormData({ ...formData, limit: e.target.value })}
                                        type="number"
                                        placeholder="10000"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="balance">Current Balance</Label>
                                    <Input
                                        id="balance"
                                        value={formData.balance}
                                        onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                                        type="number"
                                        placeholder="0"
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
                                        value={formData.cutoffDate}
                                        onChange={(e) => setFormData({ ...formData, cutoffDate: e.target.value })}
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
                                        value={formData.dueDate}
                                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                        type="number"
                                        min="1"
                                        max="31"
                                        placeholder="10"
                                        required
                                    />
                                    <p className="text-xs text-muted-foreground">Day of month payment is due</p>
                                </div>
                            </div>

                            <div className="rounded-lg border p-4 space-y-3">
                                <div className="text-sm font-semibold">Sensitive fields</div>
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
                                            <Label>Name on Card</Label>
                                            <Input
                                                value={secureData.nameOnCard || ""}
                                                onChange={(e) => setSecureData((prev) => ({ ...prev, nameOnCard: e.target.value }))}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Full Card Number</Label>
                                            <Input
                                                value={secureData.fullCardNumber || ""}
                                                onChange={(e) => setSecureData((prev) => ({ ...prev, fullCardNumber: e.target.value }))}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Expiry Date</Label>
                                            <Input
                                                value={secureData.expiryDate || ""}
                                                onChange={(e) => setSecureData((prev) => ({ ...prev, expiryDate: e.target.value }))}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>CVV</Label>
                                            <Input
                                                value={secureData.cvv || ""}
                                                onChange={(e) => setSecureData((prev) => ({ ...prev, cvv: e.target.value }))}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>PIN</Label>
                                            <Input
                                                value={secureData.pin || ""}
                                                onChange={(e) => setSecureData((prev) => ({ ...prev, pin: e.target.value }))}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>App Password / PIN</Label>
                                            <Input
                                                value={secureData.appPassword || ""}
                                                onChange={(e) => setSecureData((prev) => ({ ...prev, appPassword: e.target.value }))}
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
                                            <Label>Passphrase</Label>
                                            <Input
                                                value={secureData.passphrase || ""}
                                                onChange={(e) => setSecureData((prev) => ({ ...prev, passphrase: e.target.value }))}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Statement Password</Label>
                                            <Input
                                                value={secureData.statementPassword || ""}
                                                onChange={(e) => setSecureData((prev) => ({ ...prev, statementPassword: e.target.value }))}
                                            />
                                        </div>
                                        <div className="space-y-2 sm:col-span-2">
                                            <Label>Notes</Label>
                                            <Input
                                                value={secureData.notes || ""}
                                                onChange={(e) => setSecureData((prev) => ({ ...prev, notes: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                )}
                                <p className="text-xs text-muted-foreground">
                                    Sensitive fields are encrypted before saving.
                                </p>
                            </div>
                        </div>
                        <DialogFooter className="flex justify-between">
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={() => setDeleteOpen(true)}
                                disabled={loading}
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? "Saving..." : "Save Changes"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the card and all associated transactions.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
