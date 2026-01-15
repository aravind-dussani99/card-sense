"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Edit2, CreditCard } from "lucide-react"
import { getCardTypes, addCardType, updateCardType, deleteCardType } from "@/app/actions/card-type-actions"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function CardTypeManager() {
    const [cardTypes, setCardTypes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [editingCardType, setEditingCardType] = useState<any>(null);
    const [deleteCardTypeId, setDeleteCardTypeId] = useState<string | null>(null);
    const [formData, setFormData] = useState({ name: "", icon: "", color: "" });

    useEffect(() => {
        loadCardTypes();
    }, []);

    const loadCardTypes = async () => {
        setLoading(true);
        const data = await getCardTypes();
        setCardTypes(data);
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const result = editingCardType
            ? await updateCardType(editingCardType.id, formData.name, formData.icon, formData.color)
            : await addCardType(formData.name, formData.icon, formData.color);
        
        if (result.success) {
            setDialogOpen(false);
            setFormData({ name: "", icon: "", color: "" });
            setEditingCardType(null);
            await loadCardTypes();
        }
        setLoading(false);
    };

    const handleDelete = async () => {
        if (!deleteCardTypeId) return;
        setLoading(true);
        const result = await deleteCardType(deleteCardTypeId);
        if (result.success) {
            setDeleteDialogOpen(false);
            setDeleteCardTypeId(null);
            await loadCardTypes();
        }
        setLoading(false);
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5" />
                            Card Types
                        </CardTitle>
                        <CardDescription>
                            Manage available credit card types and networks
                        </CardDescription>
                    </div>
                    <Button onClick={() => {
                        setEditingCardType(null);
                        setFormData({ name: "", icon: "", color: "" });
                        setDialogOpen(true);
                    }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Card Type
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {loading && cardTypes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Loading...</p>
                ) : cardTypes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No card types yet. Add your first card type!</p>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {cardTypes.map((cardType) => (
                            <div key={cardType.id} className="border rounded-lg p-4 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">{cardType.name}</span>
                                        {cardType.color && (
                                            <span
                                                className="w-4 h-4 rounded-full"
                                                style={{ backgroundColor: cardType.color }}
                                            />
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setEditingCardType(cardType);
                                                setFormData({
                                                    name: cardType.name,
                                                    icon: cardType.icon || "",
                                                    color: cardType.color || "",
                                                });
                                                setDialogOpen(true);
                                            }}
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setDeleteCardTypeId(cardType.id);
                                                setDeleteDialogOpen(true);
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingCardType ? "Edit Card Type" : "Add Card Type"}</DialogTitle>
                        <DialogDescription>
                            {editingCardType ? "Update the card type details" : "Create a new card type"}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Card Type Name</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Visa, Mastercard, Amex"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="icon">Icon (optional)</Label>
                                <Input
                                    id="icon"
                                    value={formData.icon}
                                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                                    placeholder="Icon name or emoji"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="color">Color (optional)</Label>
                                <Input
                                    id="color"
                                    type="color"
                                    value={formData.color || "#000000"}
                                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                    className="h-10"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? "Saving..." : editingCardType ? "Update" : "Add"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the card type.
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
        </Card>
    );
}

