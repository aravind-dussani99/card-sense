"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type TransactionItem = {
    id: string;
    amount: number;
    date: string | Date;
    cardId?: string | null;
    bankAccountId?: string | null;
    category?: string | null;
    subCategory?: string | null;
    merchant?: string | null;
    merchantTo?: string | null;
    descriptionVia?: string | null;
    notes?: string | null;
    remarks?: string | null;
    description?: string | null;
    transactionType?: string | null;
    direction?: string | null;
    loanTo?: string | null;
    loanFrom?: string | null;
};

type AccountOption = {
    id: string;
    name?: string | null;
    type?: string | null;
    mask?: string | null;
};

type CardLite = {
    id: string;
    name?: string | null;
    last4?: string | null;
    balance?: number;
    limit?: number;
};

type CategoryLite = {
    id: string;
    name: string;
};

interface BalanceDashboardProps {
    cards: CardLite[];
    accounts: AccountOption[];
    categories: CategoryLite[];
    initialTransactions: TransactionItem[];
}

export function BalanceDashboard({ cards, accounts, categories, initialTransactions }: BalanceDashboardProps) {
    const [activeTab, setActiveTab] = useState<"summary" | "cards" | "categories" | "loans" | "merchants">("summary");
    const [dateFrom, setDateFrom] = useState<string>("");
    const [dateTo, setDateTo] = useState<string>("");
    const [selectedCard, setSelectedCard] = useState<string>("");
    const [selectedAccount, setSelectedAccount] = useState<string>("");
    const [selectedSource, setSelectedSource] = useState<string>("");
    const [selectedCategory, setSelectedCategory] = useState<string>("");
    const [selectedSubCategory, setSelectedSubCategory] = useState<string>("");
    const [selectedTransactionType, setSelectedTransactionType] = useState<string>("");
    const [selectedDirection, setSelectedDirection] = useState<string>("");
    const [selectedMerchant, setSelectedMerchant] = useState<string>("");
    const [descriptionFilter, setDescriptionFilter] = useState<string>("");
    const [notesFilter, setNotesFilter] = useState<string>("");
    const [remarksFilter, setRemarksFilter] = useState<string>("");
    const [selectedLoanPerson, setSelectedLoanPerson] = useState<string>("");
    const [merchantPage, setMerchantPage] = useState<number>(1);
    const merchantPageSize = 30;
    const subCategoryOptions = useMemo(() => {
        const set = new Set<string>();
        initialTransactions.forEach((t) => {
            if (t.subCategory) set.add(t.subCategory);
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [initialTransactions]);

    // Filter transactions based on current filters
    const filteredTransactions = useMemo(() => {
        let filtered = [...initialTransactions];

        if (dateFrom) {
            const fromDate = new Date(dateFrom);
            filtered = filtered.filter(t => new Date(t.date) >= fromDate);
        }
        if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999);
            filtered = filtered.filter(t => new Date(t.date) <= toDate);
        }
        if (selectedCard) {
            filtered = filtered.filter(t => t.cardId === selectedCard);
        }
        if (selectedAccount) {
            filtered = filtered.filter(t => t.bankAccountId === selectedAccount);
        }
        if (selectedSource) {
            filtered = filtered.filter(t => t.bankAccountId === selectedSource || t.cardId === selectedSource);
        }
        if (selectedCategory) {
            filtered = filtered.filter(t => t.category === selectedCategory);
        }
        if (selectedSubCategory) {
            filtered = filtered.filter(t => (t.subCategory || "").toLowerCase() === selectedSubCategory.toLowerCase());
        }
        if (selectedTransactionType) {
            filtered = filtered.filter(t => t.transactionType === selectedTransactionType);
        }
        if (selectedDirection) {
            filtered = filtered.filter(t => t.direction === selectedDirection);
        }
        if (selectedMerchant) {
            const search = selectedMerchant.toLowerCase();
            filtered = filtered.filter(t =>
                (t.merchant || "").toLowerCase().includes(search) ||
                (t.merchantTo || "").toLowerCase().includes(search)
            );
        }
        if (descriptionFilter) {
            const search = descriptionFilter.toLowerCase();
            filtered = filtered.filter(t =>
                (t.descriptionVia || t.description || "").toLowerCase().includes(search)
            );
        }
        if (notesFilter) {
            const search = notesFilter.toLowerCase();
            filtered = filtered.filter(t => (t.notes || "").toLowerCase().includes(search));
        }
        if (remarksFilter) {
            const search = remarksFilter.toLowerCase();
            filtered = filtered.filter(t => (t.remarks || "").toLowerCase().includes(search));
        }
        if (selectedLoanPerson && activeTab === "loans") {
            filtered = filtered.filter(t => 
                (t.transactionType === "loan_given" && t.loanTo === selectedLoanPerson) ||
                (t.transactionType === "loan_received" && t.loanFrom === selectedLoanPerson)
            );
        }

        return filtered;
    }, [initialTransactions, dateFrom, dateTo, selectedCard, selectedAccount, selectedSource, selectedCategory, selectedSubCategory, selectedTransactionType, selectedDirection, selectedMerchant, descriptionFilter, notesFilter, remarksFilter, selectedLoanPerson, activeTab]);

    useEffect(() => {
        if (activeTab === "merchants") {
            setMerchantPage(1);
        }
    }, [filteredTransactions, activeTab]);

    const merchantTransactions = useMemo(() => {
        return [...filteredTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [filteredTransactions]);

    const merchantTotalPages = Math.max(1, Math.ceil(merchantTransactions.length / merchantPageSize));
    const merchantPageSlice = useMemo(() => {
        const start = (merchantPage - 1) * merchantPageSize;
        return merchantTransactions.slice(start, start + merchantPageSize);
    }, [merchantPage, merchantTransactions, merchantPageSize]);

    useEffect(() => {
        setMerchantPage((prev) => Math.min(prev, merchantTotalPages));
    }, [merchantTotalPages]);

    const merchantKpis = useMemo(() => {
        const totalCount = merchantTransactions.length;
        const totalAmount = merchantTransactions.reduce((sum, t) => sum + t.amount, 0);
        const debit = merchantTransactions
            .filter((t) => t.direction === "debit" || t.amount < 0)
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const credit = merchantTransactions
            .filter((t) => t.direction === "credit" || t.amount > 0)
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const average = totalCount ? totalAmount / totalCount : 0;
        return { totalCount, totalAmount, debit, credit, average };
    }, [merchantTransactions]);

    const accountLookup = useMemo(() => {
        const map = new Map<string, AccountOption>();
        accounts.forEach((a) => map.set(a.id, a));
        return map;
    }, [accounts]);

    const cardLookup = useMemo(() => {
        const map = new Map<string, CardLite>();
        cards.forEach((c) => map.set(c.id, c));
        return map;
    }, [cards]);

    const renderSource = (t: TransactionItem) => {
        if (t.bankAccountId) {
            const acct = accountLookup.get(t.bankAccountId);
            if (acct) return `${acct.name || acct.type || "Account"}${acct.mask ? ` (••${acct.mask})` : ""}`;
        }
        if (t.cardId) {
            const card = cardLookup.get(t.cardId);
            if (card) return `${card.name || "Card"}${card.last4 ? ` (••${card.last4})` : ""}`;
        }
        return "—";
    };

    // Calculate KPIs
    const kpis = useMemo(() => {
        const expenses = filteredTransactions.filter(t => t.transactionType === "expense" || !t.transactionType);
        const loansGiven = filteredTransactions.filter(t => t.transactionType === "loan_given");
        const loansReceived = filteredTransactions.filter(t => t.transactionType === "loan_received");

        const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);
        const totalLoansGiven = loansGiven.reduce((sum, t) => sum + t.amount, 0);
        const totalLoansReceived = loansReceived.reduce((sum, t) => sum + t.amount, 0);
        const totalCardBalance = cards.reduce((sum, c) => sum + c.balance, 0);
        const totalCardLimit = cards.reduce((sum, c) => sum + c.limit, 0);
        const availableCredit = totalCardLimit - totalCardBalance;

        return {
            totalTransactions: filteredTransactions.length,
            totalExpenses,
            totalLoansGiven,
            totalLoansReceived,
            netLoans: totalLoansReceived - totalLoansGiven, // Positive = you owe, Negative = they owe you
            totalCardBalance,
            totalCardLimit,
            availableCredit,
            creditUtilization: totalCardLimit > 0 ? (totalCardBalance / totalCardLimit) * 100 : 0,
        };
    }, [filteredTransactions, cards]);

    // Get unique loan persons
    const loanPersons = useMemo(() => {
        const persons = new Set<string>();
        filteredTransactions.forEach(t => {
            if (t.transactionType === "loan_given" && t.loanTo) persons.add(t.loanTo);
            if (t.transactionType === "loan_received" && t.loanFrom) persons.add(t.loanFrom);
        });
        return Array.from(persons).sort();
    }, [filteredTransactions]);

    // Calculate outstanding by card
    const cardOutstanding = useMemo(() => {
        return cards.map(card => {
            const cardTransactions = filteredTransactions.filter(t => t.cardId === card.id && (t.transactionType === "expense" || !t.transactionType));
            const totalSpent = cardTransactions.reduce((sum, t) => sum + t.amount, 0);
            const outstanding = card.balance; // Current balance is what's outstanding
            return {
                ...card,
                totalSpent,
                outstanding,
                utilization: card.limit > 0 ? (card.balance / card.limit) * 100 : 0,
            };
        });
    }, [cards, filteredTransactions]);

    // Calculate outstanding by category
    const categoryOutstanding = useMemo(() => {
        const categoryMap = new Map<string, { total: number; count: number }>();
        
        filteredTransactions
            .filter(t => t.transactionType === "expense" || !t.transactionType)
            .forEach(t => {
                const key = t.category || "Uncategorized";
                const current = categoryMap.get(key) || { total: 0, count: 0 };
                categoryMap.set(key, {
                    total: current.total + t.amount,
                    count: current.count + 1,
                });
            });

        return Array.from(categoryMap.entries())
            .map(([category, data]) => ({
                category,
                total: data.total,
                count: data.count,
            }))
            .sort((a, b) => b.total - a.total);
    }, [filteredTransactions]);

    // Calculate outstanding by loan person
    const loanOutstanding = useMemo(() => {
        const loanMap = new Map<string, { given: number; received: number }>();
        
        filteredTransactions.forEach(t => {
            if (t.transactionType === "loan_given" && t.loanTo) {
                const current = loanMap.get(t.loanTo) || { given: 0, received: 0 };
                loanMap.set(t.loanTo, { ...current, given: current.given + t.amount });
            }
            if (t.transactionType === "loan_received" && t.loanFrom) {
                const current = loanMap.get(t.loanFrom) || { given: 0, received: 0 };
                loanMap.set(t.loanFrom, { ...current, received: current.received + t.amount });
            }
        });

        return Array.from(loanMap.entries())
            .map(([person, data]) => ({
                person,
                given: data.given,
                received: data.received,
            outstanding: data.received - data.given, // Positive = you owe them, Negative = they owe you
        }))
            .sort((a, b) => Math.abs(b.outstanding) - Math.abs(a.outstanding));
    }, [filteredTransactions]);

    const exportToCSV = (data: Array<Record<string, unknown>>, filename: string) => {
        if (data.length === 0) return;
        
        const headers = Object.keys(data[0]);
        const csv = [
            headers.join(','),
            ...data.map(row => 
                headers.map(header => {
                    const value = row[header];
                    if (value === null || value === undefined) return '';
                    const stringValue = String(value);
                    if (stringValue.includes(',') || stringValue.includes('"')) {
                        return `"${stringValue.replace(/"/g, '""')}"`;
                    }
                    return stringValue;
                }).join(',')
            )
        ].join('\r\n');
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    };

    const exportTableToCSV = (tableId: string, filename: string) => {
        const table = document.getElementById(tableId);
        if (!table) return;
        
        const rows = Array.from(table.querySelectorAll('tr'));
        const csv = rows.map(row => {
            const cells = Array.from(row.querySelectorAll('th,td'));
            return cells.map(cell => {
                let text = cell.textContent?.replace(/\r?\n|\r/g, ' ').trim() || '';
                if (text.includes(',') || text.includes('"')) {
                    text = `"${text.replace(/"/g, '""')}"`;
                }
                return text;
            }).join(',');
        }).join('\r\n');
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    };

    return (
        <div className="p-6 space-y-6 bg-gradient-to-br from-slate-50 via-purple-50/30 to-blue-50/50 min-h-screen">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Balance Tracking Dashboard</h1>
                    <p className="text-muted-foreground">Track all balances, receivables, and payables</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b">
                <Button
                    variant={activeTab === "summary" ? "default" : "ghost"}
                    onClick={() => setActiveTab("summary")}
                    className="rounded-b-none"
                >
                    Summary
                </Button>
                <Button
                    variant={activeTab === "cards" ? "default" : "ghost"}
                    onClick={() => setActiveTab("cards")}
                    className="rounded-b-none"
                >
                    Cards
                </Button>
                <Button
                    variant={activeTab === "categories" ? "default" : "ghost"}
                    onClick={() => setActiveTab("categories")}
                    className="rounded-b-none"
                >
                    Categories
                </Button>
                <Button
                    variant={activeTab === "loans" ? "default" : "ghost"}
                    onClick={() => setActiveTab("loans")}
                    className="rounded-b-none"
                >
                    Loans
                </Button>
                <Button
                    variant={activeTab === "merchants" ? "default" : "ghost"}
                    onClick={() => setActiveTab("merchants")}
                    className="rounded-b-none"
                >
                    Merchants
                </Button>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle>Filters</CardTitle>
                </CardHeader>
                <CardContent>
                    {activeTab === "merchants" ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <Label htmlFor="dateFrom">Date From</Label>
                                        <Input id="dateFrom" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                                    </div>
                                    <div>
                                        <Label htmlFor="dateTo">Date To</Label>
                                        <Input id="dateTo" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <Label htmlFor="source">Bank Account / Cards</Label>
                                        <Select value={selectedSource || "all"} onValueChange={(val) => setSelectedSource(val === "all" ? "" : val)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="All sources" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All sources</SelectItem>
                                                {accounts.map((acct) => (
                                                    <SelectItem key={`acct-${acct.id}`} value={acct.id}>
                                                        {(acct.name || acct.type || "Account")}{acct.mask ? ` (••${acct.mask})` : ""}
                                                    </SelectItem>
                                                ))}
                                                {cards.map((card) => (
                                                    <SelectItem key={`card-${card.id}`} value={card.id}>
                                                        {card.name} {card.last4 ? `(••${card.last4})` : ""}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label htmlFor="transactionType">Type</Label>
                                        <Select value={selectedTransactionType || "all"} onValueChange={(val) => setSelectedTransactionType(val === "all" ? "" : val)}>
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
                                    <div>
                                        <Label htmlFor="direction">Direction</Label>
                                        <Select value={selectedDirection || "all"} onValueChange={(val) => setSelectedDirection(val === "all" ? "" : val)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="All" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All</SelectItem>
                                                <SelectItem value="debit">Debit</SelectItem>
                                                <SelectItem value="credit">Credit</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <Label>MerchantTo</Label>
                                        <Input placeholder="Merchant / payee" value={selectedMerchant} onChange={(e) => setSelectedMerchant(e.target.value)} />
                                    </div>
                                    <div>
                                        <Label>DescriptionVia</Label>
                                        <Input placeholder="Description / via" value={descriptionFilter} onChange={(e) => setDescriptionFilter(e.target.value)} />
                                    </div>
                                    <div>
                                        <Label>Category</Label>
                                        <Select value={selectedCategory || "all"} onValueChange={(val) => setSelectedCategory(val === "all" ? "" : val)}>
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
                                        <Label>Sub-Category</Label>
                                        <Select value={selectedSubCategory || "all"} onValueChange={(val) => setSelectedSubCategory(val === "all" ? "" : val)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="All sub-categories" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All</SelectItem>
                                                {subCategoryOptions.map((sub) => (
                                                    <SelectItem key={sub} value={sub}>
                                                        {sub}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>Notes</Label>
                                        <Input placeholder="Notes contains..." value={notesFilter} onChange={(e) => setNotesFilter(e.target.value)} />
                                    </div>
                                    <div>
                                        <Label>Remarks</Label>
                                        <Input placeholder="Remarks contains..." value={remarksFilter} onChange={(e) => setRemarksFilter(e.target.value)} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            <div>
                                <Label htmlFor="dateFrom">Date From</Label>
                                <Input id="dateFrom" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                            </div>
                            <div>
                                <Label htmlFor="dateTo">Date To</Label>
                                <Input id="dateTo" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                            </div>
                            <div>
                                <Label htmlFor="card">Card</Label>
                                <Select value={selectedCard || "all"} onValueChange={(val) => setSelectedCard(val === "all" ? "" : val)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All Cards" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Cards</SelectItem>
                                        {cards.map(card => (
                                            <SelectItem key={card.id} value={card.id}>
                                                {card.name} {card.last4 ? `(••${card.last4})` : ""}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="account">Bank Account</Label>
                                <Select value={selectedAccount || "all"} onValueChange={(val) => setSelectedAccount(val === "all" ? "" : val)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All Accounts" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Accounts</SelectItem>
                                        {accounts.map((acct) => (
                                            <SelectItem key={acct.id} value={acct.id}>
                                                {acct.name || acct.type || "Account"} {acct.mask ? `(••${acct.mask})` : ""}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="category">Category</Label>
                                <Select value={selectedCategory || "all"} onValueChange={(val) => setSelectedCategory(val === "all" ? "" : val)}>
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
                                <Label htmlFor="subCategory">Sub-Category</Label>
                                <Select value={selectedSubCategory || "all"} onValueChange={(val) => setSelectedSubCategory(val === "all" ? "" : val)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All sub-categories" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        {subCategoryOptions.map((sub) => (
                                            <SelectItem key={sub} value={sub}>
                                                {sub}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="transactionType">Type</Label>
                                <Select value={selectedTransactionType || "all"} onValueChange={(val) => setSelectedTransactionType(val === "all" ? "" : val)}>
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
                            <div>
                                <Label htmlFor="direction">Direction</Label>
                                <Select value={selectedDirection || "all"} onValueChange={(val) => setSelectedDirection(val === "all" ? "" : val)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        <SelectItem value="debit">Debit</SelectItem>
                                        <SelectItem value="credit">Credit</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="merchant">Merchant / Payee</Label>
                                <Input
                                    id="merchant"
                                    placeholder="Search merchant"
                                    value={selectedMerchant}
                                    onChange={(e) => setSelectedMerchant(e.target.value)}
                                />
                            </div>
                            {activeTab === "loans" && loanPersons.length > 0 && (
                                <div>
                                    <Label htmlFor="loanPerson">Loan Person</Label>
                                    <Select value={selectedLoanPerson || "all"} onValueChange={(val) => setSelectedLoanPerson(val === "all" ? "" : val)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="All Persons" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Persons</SelectItem>
                                            {loanPersons.map(person => (
                                                <SelectItem key={person} value={person}>
                                                    {person}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Summary Tab */}
            {activeTab === "summary" && (
                <div className="space-y-6">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Total Transactions</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{kpis.totalTransactions.toLocaleString()}</div>
                                <p className="text-xs text-muted-foreground mt-1">Filtered transactions</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-red-600">${kpis.totalExpenses.toFixed(2)}</div>
                                <p className="text-xs text-muted-foreground mt-1">All expense transactions</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Total Card Balance</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-orange-600">${kpis.totalCardBalance.toFixed(2)}</div>
                                <p className="text-xs text-muted-foreground mt-1">Outstanding on all cards</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Available Credit</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">${kpis.availableCredit.toFixed(2)}</div>
                                <p className="text-xs text-muted-foreground mt-1">{kpis.creditUtilization.toFixed(1)}% utilized</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Outstanding Summary Table */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Outstanding Summary</CardTitle>
                                    <CardDescription>All cards, categories, and loans – receivable / payable</CardDescription>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        const summaryData = [
                                            ...cardOutstanding.map(c => ({
                                                Name: c.name,
                                                Type: 'Card',
                                                'Outstanding Amount': c.outstanding,
                                                Status: c.outstanding > 0 ? 'Payable' : 'Settled'
                                            })),
                                            ...loanOutstanding.map(l => ({
                                                Name: l.person,
                                                Type: 'Loan',
                                                'Outstanding Amount': l.outstanding,
                                                Status: l.outstanding > 0 ? 'Payable' : l.outstanding < 0 ? 'Receivable' : 'Settled'
                                            }))
                                        ];
                                        exportToCSV(summaryData, 'outstanding_summary.csv');
                                    }}
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Export CSV
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table id="summaryTable" className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left p-2">S. No.</th>
                                            <th className="text-left p-2">Name</th>
                                            <th className="text-left p-2">Type</th>
                                            <th className="text-left p-2">Outstanding Amount</th>
                                            <th className="text-left p-2">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {cardOutstanding.map((card, idx) => (
                                            <tr key={card.id} className="border-b">
                                                <td className="p-2">{idx + 1}</td>
                                                <td className="p-2">{card.name}</td>
                                                <td className="p-2">Card</td>
                                                <td className="p-2">${card.outstanding.toFixed(2)}</td>
                                                <td className="p-2">{card.outstanding > 0 ? 'Payable' : 'Settled'}</td>
                                            </tr>
                                        ))}
                                        {loanOutstanding.map((loan, idx) => (
                                            <tr key={loan.person} className="border-b">
                                                <td className="p-2">{cardOutstanding.length + idx + 1}</td>
                                                <td className="p-2">{loan.person}</td>
                                                <td className="p-2">Loan</td>
                                                <td className={`p-2 ${loan.outstanding < 0 ? 'text-red-600' : ''}`}>
                                                    ${loan.outstanding.toFixed(2)}
                                                </td>
                                                <td className={`p-2 ${loan.outstanding < 0 ? 'text-red-600' : ''}`}>
                                                    {loan.outstanding > 0 ? 'Payable' : loan.outstanding < 0 ? 'Receivable' : 'Settled'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                Positive = payable by you · Negative (red) = receivable by you (follow up).
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Merchants Tab */}
            {activeTab === "merchants" && (
                <Card>
                    <CardHeader>
                        <CardTitle>Merchants / Payees</CardTitle>
                        <CardDescription>Latest transactions with quick KPIs.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            <div className="rounded-lg border bg-white/60 p-3">
                                <p className="text-xs text-muted-foreground">Total transactions</p>
                                <p className="text-xl font-semibold">{merchantKpis.totalCount}</p>
                            </div>
                            <div className="rounded-lg border bg-white/60 p-3">
                                <p className="text-xs text-muted-foreground">Total amount</p>
                                <p className="text-xl font-semibold">
                                    £{merchantKpis.totalAmount.toFixed(2)}
                                </p>
                            </div>
                            <div className="rounded-lg border bg-white/60 p-3">
                                <p className="text-xs text-muted-foreground">Credits</p>
                                <p className="text-xl font-semibold text-emerald-600">£{merchantKpis.credit.toFixed(2)}</p>
                            </div>
                            <div className="rounded-lg border bg-white/60 p-3">
                                <p className="text-xs text-muted-foreground">Debits</p>
                                <p className="text-xl font-semibold text-rose-600">£{merchantKpis.debit.toFixed(2)}</p>
                            </div>
                            <div className="rounded-lg border bg-white/60 p-3">
                                <p className="text-xs text-muted-foreground">Avg amount</p>
                                <p className="text-xl font-semibold">£{merchantKpis.average.toFixed(2)}</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="text-sm text-muted-foreground">
                                Showing {merchantPageSlice.length} of {merchantTransactions.length} · Page {merchantPage} of {merchantTotalPages}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={merchantPage === 1}
                                    onClick={() => setMerchantPage((p) => Math.max(1, p - 1))}
                                >
                                    Previous
                                </Button>
                                {Array.from({ length: merchantTotalPages }).map((_, idx) => {
                                    const pageNum = idx + 1;
                                    if (
                                        pageNum === 1 ||
                                        pageNum === merchantTotalPages ||
                                        Math.abs(pageNum - merchantPage) <= 1
                                    ) {
                                        return (
                                            <Button
                                                key={pageNum}
                                                size="sm"
                                                variant={merchantPage === pageNum ? "default" : "outline"}
                                                onClick={() => setMerchantPage(pageNum)}
                                            >
                                                {pageNum}
                                            </Button>
                                        );
                                    }
                                    if (Math.abs(pageNum - merchantPage) === 2) {
                                        return <span key={`ellipsis-${pageNum}`} className="px-1 text-xs">…</span>;
                                    }
                                    return null;
                                })}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={merchantPage === merchantTotalPages}
                                    onClick={() => setMerchantPage((p) => Math.min(merchantTotalPages, p + 1))}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>

                        <div className="rounded-md border overflow-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/40 sticky top-0">
                                    <tr className="border-b">
                                        <th className="text-left p-3 w-14">S. No.</th>
                                        <th className="text-left p-3">Date</th>
                                        <th className="text-left p-3">Account / Card</th>
                                        <th className="text-left p-3">DescriptionVia</th>
                                        <th className="text-left p-3">MerchantTo</th>
                                        <th className="text-right p-3">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {merchantPageSlice.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="p-4 text-center text-muted-foreground">
                                                No data in this view.
                                            </td>
                                        </tr>
                                    )}
                                    {merchantPageSlice.map((t, idx) => (
                                        <tr key={t.id} className="border-b">
                                            <td className="p-3">{(merchantPage - 1) * merchantPageSize + idx + 1}</td>
                                            <td className="p-3 whitespace-nowrap">{new Date(t.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                                            <td className="p-3">{renderSource(t)}</td>
                                            <td className="p-3">{t.descriptionVia || t.description || "—"}</td>
                                            <td className="p-3">{t.merchantTo || t.merchant || "—"}</td>
                                            <td className="p-3 text-right font-semibold">
                                                £{t.amount.toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Cards Tab */}
            {activeTab === "cards" && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {cardOutstanding.map(card => (
                            <Card key={card.id}>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium">{card.name}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">${card.outstanding.toFixed(2)}</div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {card.utilization.toFixed(1)}% of ${card.limit.toFixed(2)} limit
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Card Transactions</CardTitle>
                                    <CardDescription>All transactions for selected cards</CardDescription>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => exportTableToCSV('cardTransactionsTable', 'card_transactions.csv')}
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Export CSV
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto max-h-[500px]">
                                <table id="cardTransactionsTable" className="w-full text-sm">
                                    <thead className="sticky top-0 bg-background">
                                        <tr className="border-b">
                                            <th className="text-left p-2">Date</th>
                                            <th className="text-left p-2">Card</th>
                                            <th className="text-left p-2">Merchant</th>
                                            <th className="text-left p-2">Category</th>
                                            <th className="text-left p-2">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTransactions
                                            .filter(t => t.transactionType === "expense" || !t.transactionType)
                                                    .map(transaction => (
                                                        <tr key={transaction.id} className="border-b">
                                                            <td className="p-2">{new Date(transaction.date).toLocaleDateString()}</td>
                                                            <td className="p-2">
                                                                {transaction.cardId
                                                                    ? (cardLookup.get(transaction.cardId)?.name || "Card")
                                                                    : "N/A"}
                                                            </td>
                                                            <td className="p-2">{transaction.merchantTo || transaction.merchant}</td>
                                                            <td className="p-2">{transaction.category}</td>
                                                            <td className="p-2">${transaction.amount.toFixed(2)}</td>
                                                        </tr>
                                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Categories Tab */}
            {activeTab === "categories" && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {categoryOutstanding.slice(0, 8).map((cat, idx) => (
                            <Card key={idx}>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium">{cat.category}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">${cat.total.toFixed(2)}</div>
                                    <p className="text-xs text-muted-foreground mt-1">{cat.count} transactions</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Category Transactions</CardTitle>
                                    <CardDescription>All transactions by category</CardDescription>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => exportTableToCSV('categoryTransactionsTable', 'category_transactions.csv')}
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Export CSV
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto max-h-[500px]">
                                <table id="categoryTransactionsTable" className="w-full text-sm">
                                    <thead className="sticky top-0 bg-background">
                                        <tr className="border-b">
                                            <th className="text-left p-2">Date</th>
                                            <th className="text-left p-2">Category</th>
                                            <th className="text-left p-2">Sub-Category</th>
                                            <th className="text-left p-2">Merchant</th>
                                            <th className="text-left p-2">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTransactions
                                            .filter(t => t.transactionType === "expense" || !t.transactionType)
                                            .map(transaction => (
                                                <tr key={transaction.id} className="border-b">
                                                    <td className="p-2">{new Date(transaction.date).toLocaleDateString()}</td>
                                                    <td className="p-2">{transaction.category}</td>
                                                    <td className="p-2">{transaction.subCategory || 'N/A'}</td>
                                                    <td className="p-2">{transaction.merchant}</td>
                                                    <td className="p-2">${transaction.amount.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Loans Tab */}
            {activeTab === "loans" && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Total Loans Given</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-blue-600">${kpis.totalLoansGiven.toFixed(2)}</div>
                                <p className="text-xs text-muted-foreground mt-1">Money you lent to others</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Total Loans Received</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">${kpis.totalLoansReceived.toFixed(2)}</div>
                                <p className="text-xs text-muted-foreground mt-1">Money you borrowed</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Net Loans</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold ${kpis.netLoans < 0 ? 'text-red-600' : 'text-orange-600'}`}>
                                    ${Math.abs(kpis.netLoans).toFixed(2)}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {kpis.netLoans < 0 ? 'You are owed' : 'You owe'}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Loan Outstanding</CardTitle>
                                    <CardDescription>All loans by person/entity</CardDescription>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        const loanData = loanOutstanding.map(l => ({
                                            Person: l.person,
                                            'Loans Given': l.given,
                                            'Loans Received': l.received,
                                            'Outstanding': l.outstanding,
                                            'Status': l.outstanding > 0 ? 'Payable' : l.outstanding < 0 ? 'Receivable' : 'Settled'
                                        }));
                                        exportToCSV(loanData, 'loan_outstanding.csv');
                                    }}
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Export CSV
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left p-2">Person/Entity</th>
                                            <th className="text-left p-2">Loans Given</th>
                                            <th className="text-left p-2">Loans Received</th>
                                            <th className="text-left p-2">Outstanding</th>
                                            <th className="text-left p-2">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loanOutstanding.map(loan => (
                                            <tr key={loan.person} className="border-b">
                                                <td className="p-2">{loan.person}</td>
                                                <td className="p-2">${loan.given.toFixed(2)}</td>
                                                <td className="p-2">${loan.received.toFixed(2)}</td>
                                                <td className={`p-2 ${loan.outstanding < 0 ? 'text-red-600' : ''}`}>
                                                    ${loan.outstanding.toFixed(2)}
                                                </td>
                                                <td className={`p-2 ${loan.outstanding < 0 ? 'text-red-600' : ''}`}>
                                                    {loan.outstanding > 0 ? 'Payable' : loan.outstanding < 0 ? 'Receivable' : 'Settled'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Loan Transactions</CardTitle>
                                    <CardDescription>All loan transactions</CardDescription>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => exportTableToCSV('loanTransactionsTable', 'loan_transactions.csv')}
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Export CSV
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto max-h-[500px]">
                                <table id="loanTransactionsTable" className="w-full text-sm">
                                    <thead className="sticky top-0 bg-background">
                                        <tr className="border-b">
                                            <th className="text-left p-2">Date</th>
                                            <th className="text-left p-2">Type</th>
                                            <th className="text-left p-2">Person/Entity</th>
                                            <th className="text-left p-2">Amount</th>
                                            <th className="text-left p-2">Description</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTransactions
                                            .filter(t => t.transactionType === "loan_given" || t.transactionType === "loan_received")
                                            .map(transaction => (
                                                <tr key={transaction.id} className="border-b">
                                                    <td className="p-2">{new Date(transaction.date).toLocaleDateString()}</td>
                                                    <td className="p-2">
                                                        {transaction.transactionType === "loan_given" ? 'Given' : 'Received'}
                                                    </td>
                                                    <td className="p-2">
                                                        {transaction.transactionType === "loan_given" ? transaction.loanTo : transaction.loanFrom}
                                                    </td>
                                                    <td className="p-2">${transaction.amount.toFixed(2)}</td>
                                                    <td className="p-2">{transaction.description || 'N/A'}</td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
