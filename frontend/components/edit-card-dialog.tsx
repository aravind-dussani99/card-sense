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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2 } from "lucide-react";
import { updateCard, deleteCard, type CardFormData } from "@/app/actions/card-actions";
import { getCardTypes } from "@/app/actions/card-type-actions";
import { getBanks } from "@/app/actions/bank-actions";
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
        bank: string;
        bankId?: string | null;
        last4: string;
        cardTypeId?: string | null;
        cardType?: { id: string; name: string } | null;
        limit: number;
        balance?: number;
        cutoffDate: number;
        dueDate: number;
        color: string;
        statementPassword?: string | null;
    };
}

export function EditCardDialog({ card }: EditCardDialogProps) {
    const [open, setOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [cardTypes, setCardTypes] = useState<any[]>([]);
    const [banks, setBanks] = useState<any[]>([]);
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
        statementPassword: card.statementPassword || "",
    });

    useEffect(() => {
        if (open) {
            getCardTypes().then(setCardTypes);
            getBanks().then((banksData) => {
                setBanks(banksData);
                // Find the bank ID that matches the card's bank name
                const matchingBank = banksData.find(b => b.name === card.bank);
                if (matchingBank) {
                    setSelectedBank(matchingBank.id);
                }
            });
            setSelectedCardType(card.cardTypeId || "");
            setFormData({
                name: card.name,
                last4: card.last4,
                limit: card.limit.toString(),
                balance: (card.balance || 0).toString(),
                cutoffDate: card.cutoffDate.toString(),
                dueDate: card.dueDate.toString(),
                color: card.color,
                statementPassword: card.statementPassword || "",
            });
        }
    }, [open, card]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const selectedBankData = banks.find(b => b.id === selectedBank);
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
            statementPassword: formData.statementPassword || undefined,
        };

        const result = await updateCard(card.id, data);
        setLoading(false);

        if (result.success) {
            setOpen(false);
        } else {
            alert("Failed to update card");
        }
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
            <Dialog open={open} onOpenChange={setOpen}>
                <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                </Button>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Edit Card</DialogTitle>
                        <DialogDescription>
                            Update the details of your credit card.
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

                            {/* Statement Password */}
                            <div className="space-y-2">
                                <Label htmlFor="statementPassword">Statement Password (Optional)</Label>
                                <Input
                                    id="statementPassword"
                                    type="password"
                                    value={formData.statementPassword}
                                    onChange={(e) => setFormData({ ...formData, statementPassword: e.target.value })}
                                    placeholder="Password for encrypted PDF statements"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Enter password if your bank statements are password-protected
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

