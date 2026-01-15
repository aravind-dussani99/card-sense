"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { ChevronDown, ChevronUp, Eye, Edit2, Trash2, Plus } from "lucide-react"
import { EditTransactionDialog } from "@/components/edit-transaction-dialog"
import { deleteTransaction } from "@/app/actions/transaction-actions"
import { useRouter } from "next/navigation"
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

interface TransactionsListProps {
    initialTransactions: any[];
    cards: any[];
    categories: any[];
}

export function TransactionsList({ initialTransactions, cards, categories }: TransactionsListProps) {
    const router = useRouter();
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
    const [filterCard, setFilterCard] = useState<string>("all");
    const [filterCategory, setFilterCategory] = useState<string>("all");
    const [filterType, setFilterType] = useState<string>("all");
    const [searchTerm, setSearchTerm] = useState<string>("");
    const itemsPerPage = 20;

    const toggleRow = (id: string) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedRows(newExpanded);
    };

    // Filter transactions
    const filteredTransactions = useMemo(() => {
        let filtered = [...initialTransactions];

        if (filterCard !== "all") {
            filtered = filtered.filter(t => t.cardId === filterCard);
        }
        if (filterCategory !== "all") {
            filtered = filtered.filter(t => t.category === filterCategory);
        }
        if (filterType !== "all") {
            filtered = filtered.filter(t => (t.transactionType || "expense") === filterType);
        }
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            filtered = filtered.filter(t => 
                t.merchant.toLowerCase().includes(search) ||
                t.category.toLowerCase().includes(search) ||
                (t.description && t.description.toLowerCase().includes(search))
            );
        }

        return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [initialTransactions, filterCard, filterCategory, filterType, searchTerm]);

    // Pagination
    const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
    const paginatedTransactions = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredTransactions.slice(start, start + itemsPerPage);
    }, [filteredTransactions, currentPage]);

    const handleDelete = async () => {
        if (!transactionToDelete) return;
        const result = await deleteTransaction(transactionToDelete);
        if (result.success) {
            setDeleteDialogOpen(false);
            setTransactionToDelete(null);
            router.refresh();
        }
    };

    const formatDate = (date: Date | string) => {
        const d = new Date(date);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(amount);
    };

    return (
        <div className="space-y-4">
            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <Label htmlFor="search">Search</Label>
                            <Input
                                id="search"
                                placeholder="Search merchant, category..."
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(1);
                                }}
                            />
                        </div>
                        <div>
                            <Label htmlFor="cardFilter">Card</Label>
                            <Select value={filterCard} onValueChange={(val) => {
                                setFilterCard(val);
                                setCurrentPage(1);
                            }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Cards" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Cards</SelectItem>
                                    {cards.map(card => (
                                        <SelectItem key={card.id} value={card.id}>
                                            {card.name} (••{card.last4})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="categoryFilter">Category</Label>
                            <Select value={filterCategory} onValueChange={(val) => {
                                setFilterCategory(val);
                                setCurrentPage(1);
                            }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Categories" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Categories</SelectItem>
                                    {categories.map(cat => (
                                        <SelectItem key={cat.id} value={cat.name}>
                                            {cat.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="typeFilter">Type</Label>
                            <Select value={filterType} onValueChange={(val) => {
                                setFilterType(val);
                                setCurrentPage(1);
                            }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Types" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="expense">Expense</SelectItem>
                                    <SelectItem value="loan_given">Loan Given</SelectItem>
                                    <SelectItem value="loan_received">Loan Received</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Transactions Table */}
            <Card>
                <CardContent className="pt-6">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12"></TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Merchant</TableHead>
                                    <TableHead>Card</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead className="w-32">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedTransactions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                            No transactions found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedTransactions.map((transaction) => {
                                        const isExpanded = expandedRows.has(transaction.id);
                                        return (
                                            <React.Fragment key={transaction.id}>
                                                <TableRow className="cursor-pointer hover:bg-muted/50">
                                                    <TableCell>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => toggleRow(transaction.id)}
                                                        >
                                                            {isExpanded ? (
                                                                <ChevronUp className="h-4 w-4" />
                                                            ) : (
                                                                <ChevronDown className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    </TableCell>
                                                    <TableCell>{formatDate(transaction.date)}</TableCell>
                                                    <TableCell className="font-medium">{transaction.merchant}</TableCell>
                                                    <TableCell>
                                                        {transaction.card ? (
                                                            <span>{transaction.card.name} (••{transaction.card.last4})</span>
                                                        ) : (
                                                            <span className="text-muted-foreground">N/A</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            {transaction.category}
                                                            {transaction.subCategory && (
                                                                <span className="text-xs text-muted-foreground">
                                                                    / {transaction.subCategory}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium">
                                                        {formatCurrency(transaction.amount)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-1">
                                                            <EditTransactionDialog 
                                                                transaction={transaction} 
                                                                cards={cards} 
                                                                categories={categories}
                                                            />
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-destructive hover:text-destructive"
                                                                onClick={() => {
                                                                    setTransactionToDelete(transaction.id);
                                                                    setDeleteDialogOpen(true);
                                                                }}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                                {isExpanded && (
                                                    <TableRow>
                                                        <TableCell colSpan={7} className="bg-muted/30">
                                                            <div className="p-4 space-y-3">
                                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                                    <div>
                                                                        <Label className="text-xs text-muted-foreground">Transaction Type</Label>
                                                                        <p className="font-medium capitalize">
                                                                            {transaction.transactionType || "expense"}
                                                                        </p>
                                                                    </div>
                                                                    <div>
                                                                        <Label className="text-xs text-muted-foreground">Date</Label>
                                                                        <p className="font-medium">{formatDate(transaction.date)}</p>
                                                                    </div>
                                                                    <div>
                                                                        <Label className="text-xs text-muted-foreground">Amount</Label>
                                                                        <p className="font-medium">{formatCurrency(transaction.amount)}</p>
                                                                    </div>
                                                                    <div>
                                                                        <Label className="text-xs text-muted-foreground">Category</Label>
                                                                        <p className="font-medium">
                                                                            {transaction.category}
                                                                            {transaction.subCategory && ` / ${transaction.subCategory}`}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                {transaction.description && (
                                                                    <div>
                                                                        <Label className="text-xs text-muted-foreground">Description</Label>
                                                                        <p className="text-sm mt-1">{transaction.description}</p>
                                                                    </div>
                                                                )}
                                                                {(transaction.transactionType === "loan_given" || transaction.transactionType === "loan_received") && (
                                                                    <div>
                                                                        <Label className="text-xs text-muted-foreground">
                                                                            {transaction.transactionType === "loan_given" ? "Loaned To" : "Loaned From"}
                                                                        </Label>
                                                                        <p className="font-medium">
                                                                            {transaction.transactionType === "loan_given" ? transaction.loanTo : transaction.loanFrom}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <Label className="text-xs text-muted-foreground">Transaction ID</Label>
                                                                    <p className="text-xs font-mono text-muted-foreground">{transaction.id}</p>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4">
                            <div className="text-sm text-muted-foreground">
                                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length} transactions
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                >
                                    Previous
                                </Button>
                                <div className="text-sm">
                                    Page {currentPage} of {totalPages}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete this transaction. This action cannot be undone.
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
        </div>
    );
}

