"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Edit2, Tag } from "lucide-react"
import { getCategories, addCategory, updateCategory, deleteCategory, addSubCategory, deleteSubCategory } from "@/app/actions/category-actions"
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

export function CategoryManager() {
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<any>(null);
    const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);
    const [formData, setFormData] = useState({ name: "", icon: "", color: "" });
    const [newSubCategory, setNewSubCategory] = useState<Record<string, string>>({});

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        setLoading(true);
        const data = await getCategories();
        setCategories(data);
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const result = editingCategory
            ? await updateCategory(editingCategory.id, formData.name, formData.icon, formData.color)
            : await addCategory(formData.name, formData.icon, formData.color);
        
        if (result.success) {
            setDialogOpen(false);
            setFormData({ name: "", icon: "", color: "" });
            setEditingCategory(null);
            await loadCategories();
        }
        setLoading(false);
    };

    const handleDelete = async () => {
        if (!deleteCategoryId) return;
        setLoading(true);
        const result = await deleteCategory(deleteCategoryId);
        if (result.success) {
            setDeleteDialogOpen(false);
            setDeleteCategoryId(null);
            await loadCategories();
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
            await loadCategories();
        }
        setLoading(false);
    };

    const handleDeleteSubCategory = async (id: string) => {
        setLoading(true);
        const result = await deleteSubCategory(id);
        if (result.success) {
            await loadCategories();
        }
        setLoading(false);
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Tag className="h-5 w-5" />
                            Expense Categories
                        </CardTitle>
                        <CardDescription>
                            Manage your expense categories and sub-categories
                        </CardDescription>
                    </div>
                    <Button onClick={() => {
                        setEditingCategory(null);
                        setFormData({ name: "", icon: "", color: "" });
                        setDialogOpen(true);
                    }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Category
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {loading && categories.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Loading...</p>
                ) : categories.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No categories yet. Add your first category!</p>
                ) : (
                    <div className="space-y-4">
                        {categories.map((category) => (
                            <div key={category.id} className="border rounded-lg p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">{category.name}</span>
                                        {category.color && (
                                            <span
                                                className="w-4 h-4 rounded-full"
                                                style={{ backgroundColor: category.color }}
                                            />
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setEditingCategory(category);
                                                setFormData({
                                                    name: category.name,
                                                    icon: category.icon || "",
                                                    color: category.color || "",
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
                                                setDeleteCategoryId(category.id);
                                                setDeleteDialogOpen(true);
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="text-sm font-medium text-muted-foreground">Sub-categories:</div>
                                    <div className="flex flex-wrap gap-2">
                                        {category.subCategories.map((sub: any) => (
                                            <span
                                                key={sub.id}
                                                className="inline-flex items-center gap-1 px-2 py-1 bg-secondary rounded-md text-sm"
                                            >
                                                {sub.name}
                                                <button
                                                    onClick={() => handleDeleteSubCategory(sub.id)}
                                                    className="text-destructive hover:text-destructive/80"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="Add sub-category"
                                            value={newSubCategory[category.id] || ""}
                                            onChange={(e) =>
                                                setNewSubCategory({ ...newSubCategory, [category.id]: e.target.value })
                                            }
                                            className="max-w-xs"
                                            onKeyPress={(e) => {
                                                if (e.key === "Enter") {
                                                    handleAddSubCategory(category.id);
                                                }
                                            }}
                                        />
                                        <Button
                                            size="sm"
                                            onClick={() => handleAddSubCategory(category.id)}
                                            disabled={!newSubCategory[category.id]}
                                        >
                                            <Plus className="h-4 w-4" />
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
                        <DialogTitle>{editingCategory ? "Edit Category" : "Add Category"}</DialogTitle>
                        <DialogDescription>
                            {editingCategory ? "Update the category details" : "Create a new expense category"}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Category Name</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Food, Travel"
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
                                {loading ? "Saving..." : editingCategory ? "Update" : "Add"}
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
                            This will permanently delete the category and all its sub-categories.
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

