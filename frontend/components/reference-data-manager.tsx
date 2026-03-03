"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Plus, Trash2, Edit2, Tag, ClipboardList } from "lucide-react"
import { getCategories, addCategory, updateCategory, deleteCategory, addSubCategory, deleteSubCategory, updateSubCategory } from "@/app/actions/category-actions"
import { getHeadAccounts, addHeadAccount, updateHeadAccount, deleteHeadAccount } from "@/app/actions/head-account-actions"
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
import { Category, SubCategory, HeadAccount } from "@/lib/types"

type DataType = "categories" | "subCategories" | "headAccounts";

interface ListItem {
    id: string;
    name: string;
    type: DataType;
    icon?: string;
    color?: string;
    categoryId?: string;
    categoryName?: string;
}

interface ReferenceDataManagerProps {
    initialCategories: Category[];
    initialHeadAccounts: HeadAccount[];
}

export function ReferenceDataManager({ initialCategories, initialHeadAccounts }: ReferenceDataManagerProps) {
    const router = useRouter();
    const [categories, setCategories] = useState<Category[]>(initialCategories);
    const [headAccounts, setHeadAccounts] = useState<HeadAccount[]>(initialHeadAccounts);
    const [loading, setLoading] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<ListItem | null>(null);
    const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
    const [deleteItemType, setDeleteItemType] = useState<DataType | null>(null);
    const [formData, setFormData] = useState({ name: "", icon: "", color: "", categoryId: "", type: "" });
    const [newSubCategory, setNewSubCategory] = useState<Record<string, string>>({});
    const [editingSub, setEditingSub] = useState<{ id: string; name: string } | null>(null);

    const loadData = async () => {
        setLoading(true);
        const [categoriesData, headAccountsData] = await Promise.all([
            getCategories(),
            getHeadAccounts(),
        ]);
        setCategories(categoriesData);
        setHeadAccounts(headAccountsData);
        setLoading(false);
    };

    const handleAddNew = (type: DataType) => {
        setEditingItem(null);
        setFormData({ name: "", icon: "", color: "", categoryId: "", type: "" });
        setDialogOpen(true);
        // Store the type in editingItem temporarily
        setEditingItem({ id: "", name: "", type } as ListItem);
    };

    const handleEdit = (item: ListItem) => {
        setEditingItem(item);
        if (item.type === "categories") {
            const category = categories.find(c => c.id === item.id);
            setFormData({
                name: category?.name || "",
                icon: category?.icon || "",
                color: category?.color || "",
                categoryId: "",
                type: "",
            });
        } else if (item.type === "headAccounts") {
            const headAccount = headAccounts.find(h => h.id === item.id);
            setFormData({
                name: headAccount?.name || "",
                icon: "",
                color: "",
                categoryId: "",
                type: "",
            });
        }
        setDialogOpen(true);
    };

    const handleDelete = (id: string, type: DataType) => {
        setDeleteItemId(id);
        setDeleteItemType(type);
        setDeleteDialogOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingItem) return;

        setLoading(true);
        let result;

        if (editingItem.type === "categories") {
            result = editingItem.id
                ? await updateCategory(editingItem.id, formData.name, formData.icon, formData.color)
                : await addCategory(formData.name, formData.icon, formData.color);
        } else if (editingItem.type === "headAccounts") {
            result = editingItem.id
                ? await updateHeadAccount(editingItem.id, formData.name)
                : await addHeadAccount(formData.name);
        }

        if (result?.success) {
            setDialogOpen(false);
            setFormData({ name: "", icon: "", color: "", categoryId: "", type: "" });
            setEditingItem(null);
            await loadData();
        }
        setLoading(false);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteItemId || !deleteItemType) return;

        setLoading(true);
        let result;

        if (deleteItemType === "categories") {
            result = await deleteCategory(deleteItemId);
        } else if (deleteItemType === "subCategories") {
            result = await deleteSubCategory(deleteItemId);
        } else if (deleteItemType === "headAccounts") {
            result = await deleteHeadAccount(deleteItemId);
        }

        if (result?.success) {
            setDeleteDialogOpen(false);
            setDeleteItemId(null);
            setDeleteItemType(null);
            await loadData();
        }
        setLoading(false);
    };

    const handleAddSubCategory = async (categoryId: string) => {
        const name = newSubCategory[categoryId];
        if (!name) return;
        setLoading(true);
        const result = await addSubCategory(categoryId, name);
        if (result.success) {
            setNewSubCategory({ ...newSubCategory, [categoryId]: "" });
            await loadData();
        }
        setLoading(false);
    };

    const handleDeleteSubCategory = async (id: string) => {
        setLoading(true);
        const result = await deleteSubCategory(id);
        if (result.success) {
            await loadData();
        }
        setLoading(false);
    };

    const handleUpdateSubCategory = async () => {
        if (!editingSub) return;
        setLoading(true);
        const result = await updateSubCategory(editingSub.id, editingSub.name);
        setLoading(false);
        if (result.success) {
            setEditingSub(null);
            await loadData();
        }
    };

    const getTypeLabel = (type: DataType) => {
        switch (type) {
            case "categories":
                return "Category";
            case "subCategories":
                return "Sub-Category";
            case "headAccounts":
                return "Head Account";
            default:
                return "";
        }
    };

    return (
        <div className="space-y-3 p-3 sm:p-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 sm:h-8 sm:w-8"
                        onClick={() => router.back()}
                    >
                        <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </Button>
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Reference Data</h2>
                        <p className="text-xs sm:text-sm text-muted-foreground">Manage head accounts, categories, and sub-categories</p>
                    </div>
                </div>
            </div>

            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                <Card>
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-1.5 text-sm sm:text-base">
                                    <ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                    Head Accounts
                                </CardTitle>
                                <CardDescription className="text-xs">Manage head accounts</CardDescription>
                            </div>
                            <Button onClick={() => handleAddNew("headAccounts")} size="sm" className="h-6 sm:h-7 text-xs px-1.5 sm:px-2">
                                <Plus className="h-3 w-3 mr-0.5 sm:mr-1" />
                                Add
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="space-y-1 max-h-[250px] sm:max-h-[300px] overflow-y-auto">
                            {headAccounts.map((account) => (
                                <div key={account.id} className="flex items-center justify-between p-1.5 border rounded text-sm">
                                    <span className="truncate flex-1">{account.name}</span>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleEdit({
                                            id: account.id,
                                            name: account.name,
                                            type: "headAccounts",
                                        })}>
                                            <Edit2 className="h-3 w-3" />
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleDelete(account.id, "headAccounts")}>
                                            <Trash2 className="h-3 w-3 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-1.5 text-sm sm:text-base">
                                <Tag className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                Categories & Sub-Categories
                            </CardTitle>
                            <CardDescription className="text-xs">Manage expense categories and sub-categories</CardDescription>
                        </div>
                        <Button onClick={() => handleAddNew("categories")} size="sm" className="h-6 sm:h-7 text-xs px-1.5 sm:px-2">
                            <Plus className="h-3 w-3 mr-0.5 sm:mr-1" />
                            Add Category
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
                        {categories.map((category) => (
                            <div key={category.id} className="border rounded-lg p-2 sm:p-3 space-y-1.5 sm:space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-medium text-sm">{category.name}</span>
                                            {category.color && (
                                                <span
                                                    className="w-3 h-3 rounded-full shrink-0"
                                                    style={{ backgroundColor: category.color }}
                                                />
                                            )}
                                        </div>
                                        <div className="flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0"
                                            onClick={() => handleEdit({
                                                id: category.id,
                                                name: category.name,
                                                type: "categories",
                                                icon: category.icon ?? undefined,
                                                color: category.color ?? undefined,
                                            })}
                                            >
                                                <Edit2 className="h-3 w-3" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0"
                                                onClick={() => handleDelete(category.id, "categories")}
                                            >
                                                <Trash2 className="h-3 w-3 text-destructive" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-xs font-medium text-muted-foreground">Sub-categories:</div>
                                        <div className="flex flex-wrap gap-0.5 sm:gap-1">
                                            {category.subCategories?.map((sub: SubCategory) => (
                                                <span
                                                    key={sub.id}
                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-secondary rounded text-xs"
                                                >
                                                    {editingSub?.id === sub.id ? (
                                                        <>
                                                            <input
                                                                className="bg-transparent border-b border-dashed border-gray-400 text-xs focus:outline-none"
                                                                value={editingSub.name}
                                                                onChange={(e) => setEditingSub({ ...editingSub, name: e.target.value })}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === "Enter") {
                                                                        e.preventDefault();
                                                                        void handleUpdateSubCategory();
                                                                    }
                                                                }}
                                                            />
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-4 w-4"
                                                                onClick={() => setEditingSub(null)}
                                                                aria-label="Cancel rename"
                                                            >
                                                                ✕
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            {sub.name}
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-4 w-4"
                                                                onClick={() => setEditingSub({ id: sub.id, name: sub.name })}
                                                                aria-label="Rename sub-category"
                                                            >
                                                                ✎
                                                            </Button>
                                                        </>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-4 w-4 text-destructive hover:text-destructive/80"
                                                        onClick={() => handleDeleteSubCategory(sub.id)}
                                                    >
                                                        <Trash2 className="h-2.5 w-2.5" />
                                                    </Button>
                                                </span>
                                            ))}
                                        </div>
                                        <div className="flex gap-1">
                                            <Input
                                                placeholder="Add sub-category"
                                                value={newSubCategory[category.id] || ""}
                                                onChange={(e) =>
                                                    setNewSubCategory({ ...newSubCategory, [category.id]: e.target.value })
                                                }
                                                className="h-6 sm:h-7 text-xs flex-1"
                                                onKeyPress={(e) => {
                                                    if (e.key === "Enter") {
                                                        handleAddSubCategory(category.id);
                                                    }
                                                }}
                                            />
                                            <Button
                                                size="sm"
                                                className="h-6 sm:h-7 w-6 sm:w-7 p-0 shrink-0"
                                                onClick={() => handleAddSubCategory(category.id)}
                                                disabled={!newSubCategory[category.id]}
                                            >
                                                <Plus className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingItem?.id ? `Edit ${getTypeLabel(editingItem.type)}` : `Add ${getTypeLabel(editingItem?.type || "categories")}`}
                        </DialogTitle>
                        <DialogDescription>
                            {editingItem?.id ? "Update the details" : `Create a new ${getTypeLabel(editingItem?.type || "categories").toLowerCase()}`}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Enter name"
                                    required
                                />
                            </div>
                            {editingItem?.type === "categories" && (
                                <>
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
                                </>
                            )}
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? "Saving..." : editingItem?.id ? "Update" : "Add"}
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
                            This will permanently delete this item. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
