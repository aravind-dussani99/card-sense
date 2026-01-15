"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Check, X, Edit2, Trash2, AlertCircle } from "lucide-react";
import {
    approveDraftTransaction,
    rejectDraftTransaction,
    updateDraftTransaction,
    deleteDraftTransaction,
} from "@/app/actions/draft-transaction-actions";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
import { useRouter } from "next/navigation";

interface DraftTransactionsListProps {
    initialDrafts: any[];
    cards: any[];
    categories: any[];
    total: number;
    page: number;
    pageSize: number;
}

export function DraftTransactionsList({ initialDrafts, cards, categories, total, page, pageSize }: DraftTransactionsListProps) {
    const router = useRouter();
    const [drafts, setDrafts] = useState(initialDrafts);
    
    // Refresh drafts when initialDrafts changes (e.g., after email processing)
    useEffect(() => {
        setDrafts(initialDrafts);
    }, [initialDrafts]);
    
    const [editingDraft, setEditingDraft] = useState<any>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [draftToDelete, setDraftToDelete] = useState<string | null>(null);
    const [draftToReject, setDraftToReject] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        merchant: "",
        amount: "",
        category: "",
        subCategory: "",
        description: "",
        date: "",
        cardId: "",
    });

    const handleApprove = async (id: string) => {
        setLoading(true);
        const result = await approveDraftTransaction(id);
        setLoading(false);
        if (result.success) {
            setDrafts(drafts.filter(d => d.id !== id));
            router.refresh();
        } else {
            alert(result.error || "Failed to approve transaction");
        }
    };

    const handleReject = async () => {
        if (!draftToReject) return;
        setLoading(true);
        const result = await rejectDraftTransaction(draftToReject);
        setLoading(false);
        if (result.success) {
            setRejectDialogOpen(false);
            setDraftToReject(null);
            setDrafts(drafts.filter(d => d.id !== draftToReject));
            router.refresh();
        } else {
            alert(result.error || "Failed to reject transaction");
        }
    };

    const handleEdit = (draft: any) => {
        setEditingDraft(draft);
        setFormData({
            merchant: draft.merchant,
            amount: draft.amount.toString(),
            category: draft.category || "",
            subCategory: draft.subCategory || "",
            description: draft.description || "",
            date: new Date(draft.date).toISOString().split('T')[0],
            cardId: draft.cardId || "",
        });
        setEditDialogOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!editingDraft) return;
        setLoading(true);
        const result = await updateDraftTransaction(editingDraft.id, {
            merchant: formData.merchant,
            amount: Number(formData.amount),
            category: formData.category === "uncategorized" ? undefined : formData.category,
            subCategory: formData.subCategory,
            description: formData.description,
            date: new Date(formData.date),
            cardId: formData.cardId === "none" ? undefined : (formData.cardId || undefined),
            status: "modified",
            modifiedData: JSON.stringify(formData),
        });
        setLoading(false);
        if (result.success) {
            setEditDialogOpen(false);
            setDrafts(drafts.map(d => d.id === editingDraft.id ? { ...d, ...formData } : d));
            router.refresh();
        } else {
            alert(result.error || "Failed to update transaction");
        }
    };

    const handleDelete = async () => {
        if (!draftToDelete) return;
        setLoading(true);
        const result = await deleteDraftTransaction(draftToDelete);
        setLoading(false);
        if (result.success) {
            setDeleteDialogOpen(false);
            setDraftToDelete(null);
            setDrafts(drafts.filter(d => d.id !== draftToDelete));
            router.refresh();
        } else {
            alert(result.error || "Failed to delete transaction");
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(amount);
    };

    const formatDate = (date: Date | string) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    if (drafts.length === 0) {
        return (
            <Card>
                <CardContent className="p-8 text-center">
                    <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Pending Drafts</h3>
                    <p className="text-muted-foreground">
                        All transactions have been reviewed. New drafts will appear here when emails are processed.
                    </p>
                </CardContent>
            </Card>
        );
    }

    // Calculate drafts that need card/account creation
    const draftsNeedingCard = drafts.filter(draft => draft.needsCardCreation === true).length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return (
        <>
            {draftsNeedingCard > 0 && (
                <Card className="mb-4 border-orange-200 bg-orange-50">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-orange-600" />
                            <div>
                                <p className="font-medium text-orange-900">
                                    {draftsNeedingCard} transaction{draftsNeedingCard > 1 ? 's' : ''} need card/account creation
                                </p>
                                <p className="text-sm text-orange-700">
                                    These transactions were found for cards/accounts not in your database. You can create them when approving the transactions.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>To</TableHead>
                                <TableHead>Source</TableHead>
                                <TableHead>Card</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="w-32">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {drafts.map((draft) => (
                                <TableRow key={draft.id}>
                                    <TableCell>{formatDate(draft.date)}</TableCell>
                                    <TableCell className="font-medium">{draft.merchant}</TableCell>
                                    <TableCell>
                                        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
                                            {draft.source || "email"}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        {draft.card ? (
                                            <span>{draft.card.name} (••{draft.card.last4})</span>
                                        ) : (() => {
                                            // Parse detected card/account info from originalData
                                            let detectedCardLast4: string | null = null;
                                            let detectedAccountNumber: string | null = null;
                                            if (draft.originalData) {
                                                try {
                                                    const original = JSON.parse(draft.originalData);
                                                    detectedCardLast4 = original.cardLast4 || null;
                                                    detectedAccountNumber = original.accountNumber || null;
                                                } catch (e) {
                                                    // Ignore parse errors
                                                }
                                            }
                                            return detectedCardLast4 ? (
                                                <span className="text-orange-600 font-medium">
                                                    Card ••{detectedCardLast4} (Not in database)
                                                </span>
                                            ) : detectedAccountNumber ? (
                                                <span className="text-orange-600 font-medium">
                                                    Account {detectedAccountNumber} (Not in database)
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">No card/account</span>
                                            );
                                        })()}
                                    </TableCell>
                                    <TableCell>
                                        {draft.category || <span className="text-muted-foreground">Uncategorized</span>}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        {formatCurrency(draft.amount)}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-green-600 hover:text-green-700"
                                                onClick={() => handleApprove(draft.id)}
                                                disabled={loading}
                                            >
                                                <Check className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => handleEdit(draft)}
                                                disabled={loading}
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-red-600 hover:text-red-700"
                                                onClick={() => {
                                                    setDraftToReject(draft.id);
                                                    setRejectDialogOpen(true);
                                                }}
                                                disabled={loading}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive"
                                                onClick={() => {
                                                    setDraftToDelete(draft.id);
                                                    setDeleteDialogOpen(true);
                                                }}
                                                disabled={loading}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                    Page {page} of {totalPages} · {total} total
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => router.push(`/drafts?page=${page - 1}`)}
                    >
                        Prev
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages}
                        onClick={() => router.push(`/drafts?page=${page + 1}`)}
                    >
                        Next
                    </Button>
                </div>
            </div>

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Edit Draft Transaction</DialogTitle>
                        <DialogDescription>
                            Modify the transaction details before approving
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="merchant">Merchant</Label>
                                <Input
                                    id="merchant"
                                    value={formData.merchant}
                                    onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="amount">Amount</Label>
                                <Input
                                    id="amount"
                                    type="number"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="cardId">Card</Label>
                                <Select value={formData.cardId} onValueChange={(value) => setFormData({ ...formData, cardId: value })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select card" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No card</SelectItem>
                                        {cards.map((card) => (
                                            <SelectItem key={card.id} value={card.id}>
                                                {card.name} (••{card.last4})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="date">Date</Label>
                                <Input
                                    id="date"
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="category">Category</Label>
                                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="uncategorized">Uncategorized</SelectItem>
                                        {categories.map((cat) => (
                                            <SelectItem key={cat.id} value={cat.name}>
                                                {cat.icon && <span className="mr-2">{cat.icon}</span>}
                                                {cat.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Input
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveEdit} disabled={loading}>
                            {loading ? "Saving..." : "Save & Approve"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Dialog */}
            {/* Reject Confirmation Dialog */}
            <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                <AlertDialogContent className="z-50">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reject Draft Transaction?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will mark this draft transaction as rejected. You can still view it later, but it won't appear in pending drafts.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDraftToReject(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleReject} className="bg-orange-600 hover:bg-orange-700 text-white">
                            Reject
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent className="z-[100] max-w-md border-2 border-destructive/50 bg-background">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold text-destructive">⚠️ Delete Draft Transaction?</AlertDialogTitle>
                        <AlertDialogDescription className="text-base mt-2">
                            This will permanently delete this draft transaction. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-3 mt-4">
                        <AlertDialogCancel onClick={() => setDraftToDelete(null)} className="mt-0">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleDelete} 
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold"
                        >
                            Delete Permanently
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
