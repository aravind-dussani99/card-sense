"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Eye, RefreshCw } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

type SourceOption = {
    id: string;
    label: string;
    helper?: string;
    type: "account" | "card";
};

type ApprovedRecord = {
    id: string;
    sourceType: "account" | "card";
    bankAccountId?: string | null;
    cardId?: string | null;
    merchantName?: string | null;
    description?: string | null;
    amount: number;
    currency?: string | null;
    category?: string | null;
    subCategory?: string | null;
    categoryId?: string | null;
    subCategoryId?: string | null;
    bookingDate: string | null;
    valueDate?: string | null;
    approvedAt?: string | null;
    bankAccount?: { id: string; name: string | null; type: string | null; mask: string | null } | null;
    card?: { id: string; name: string | null; last4: string | null } | null;
    categoryRef?: { id: string; name: string } | null;
    subCategoryRef?: { id: string; name: string; categoryId: string } | null;
};

type Meta = {
    page: number;
    pageSize: number;
    total: number;
};

interface ApprovedTransactionsBoardProps {
    accounts: SourceOption[];
    cards: SourceOption[];
    initialData: ApprovedRecord[];
    initialMeta: Meta;
    categories: Array<{
        id: string;
        name: string;
        subCategories: Array<{ id: string; name: string; categoryId: string }>;
    }>;
}

const PAGE_SIZE = 30;

export function ApprovedTransactionsBoard({
    accounts,
    cards,
    initialData,
    initialMeta,
    categories,
}: ApprovedTransactionsBoardProps) {
    const [filters, setFilters] = useState({
        scope: "all",
        sourceId: "all",
        from: "",
        to: "",
        categoryId: "all",
        subCategoryId: "all",
        search: "",
    });
    const [transactions, setTransactions] = useState<ApprovedRecord[]>(initialData);
    const [meta, setMeta] = useState<Meta>(initialMeta);
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [dialogRecord, setDialogRecord] = useState<ApprovedRecord | null>(null);

    const availableSources = useMemo(() => {
        if (filters.scope === "account") return accounts;
        if (filters.scope === "card") return cards;
        return [];
    }, [filters.scope, accounts, cards]);

    const categoryLookup = useMemo(() => {
        const map = new Map<string, { id: string; name: string; subCategories: Array<{ id: string; name: string; categoryId: string }> }>();
        categories.forEach((category) => map.set(category.id, category));
        return map;
    }, [categories]);

    const availableFilterSubCategories = useMemo(() => {
        if (filters.categoryId === "all") return [];
        return categoryLookup.get(filters.categoryId)?.subCategories ?? [];
    }, [filters.categoryId, categoryLookup]);

    const totalPages = Math.max(1, Math.ceil(meta.total / meta.pageSize));

    const buildPageList = (current: number, total: number) => {
        const pages = new Set<number>();
        pages.add(1);
        pages.add(total);
        for (let i = current - 1; i <= current + 1; i += 1) {
            if (i > 1 && i < total) pages.add(i);
        }
        const sorted = Array.from(pages).sort((a, b) => a - b);
        const output: (number | string)[] = [];
        for (let i = 0; i < sorted.length; i += 1) {
            const page = sorted[i];
            if (i > 0 && page - sorted[i - 1] > 1) output.push("ellipsis");
            output.push(page);
        }
        return output;
    };

    const pageItems = useMemo(() => buildPageList(meta.page, totalPages), [meta.page, totalPages]);

    const buildParams = (page: number) => {
        const params = new URLSearchParams({
            page: String(page),
            pageSize: String(PAGE_SIZE),
        });
        if (filters.scope !== "all") {
            params.set("sourceType", filters.scope);
        }
        if (filters.sourceId !== "all") {
            params.set("sourceId", filters.sourceId);
        }
        if (filters.categoryId !== "all") params.set("categoryId", filters.categoryId);
        if (filters.subCategoryId !== "all") params.set("subCategoryId", filters.subCategoryId);
        if (filters.from) params.set("from", filters.from);
        if (filters.to) params.set("to", filters.to);
        if (filters.search) params.set("search", filters.search);
        return params;
    };

    const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong");

    const readJson = async <T,>(response: Response): Promise<T> => {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            return (await response.json()) as T;
        }
        const fallback = await response.text();
        throw new Error(fallback || "Server returned an unexpected response");
    };

    const fetchTransactions = async (page: number) => {
        setLoading(true);
        setFeedback(null);
        try {
            const params = buildParams(page);
            const response = await fetch(`/api/sync-workbench/approved?${params.toString()}`, { cache: "no-store" });
            const data = await readJson<{ success: boolean; data: ApprovedRecord[]; meta: Meta; error?: string }>(response);
            if (!response.ok || !data.success) throw new Error(data.error || "Failed to load transactions");
            setTransactions(data.data);
            setMeta(data.meta);
        } catch (error: unknown) {
            setFeedback({ type: "error", message: getErrorMessage(error) || "Failed to load transactions" });
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        fetchTransactions(1);
    };

    const resetFilters = () => {
        setFilters({
            scope: "all",
            sourceId: "all",
            from: "",
            to: "",
            categoryId: "all",
            subCategoryId: "all",
            search: "",
        });
        setFeedback(null);
        fetchTransactions(1);
    };

    const formatCurrency = (amount: number, currency?: string | null) => {
        try {
            return new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: currency || "USD",
                minimumFractionDigits: 2,
            }).format(amount ?? 0);
        } catch {
            return `${currency || "USD"} ${amount?.toFixed(2) ?? "0.00"}`;
        }
    };

    const formatDate = (value?: string | null) => {
        if (!value) return "—";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "—";
        return new Intl.DateTimeFormat("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        }).format(date);
    };

    const resolveSourceLabel = (record: ApprovedRecord) => {
        if (record.sourceType === "account") {
            const name = record.bankAccount?.name || "Account";
            const helper = record.bankAccount?.mask ? `••${record.bankAccount.mask}` : record.bankAccount?.type || "";
            return `${name}${helper ? ` (${helper})` : ""}`;
        }
        const name = record.card?.name || "Card";
        const helper = record.card?.last4 ? `••${record.card.last4}` : "";
        return `${name}${helper ? ` (${helper})` : ""}`;
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="pb-4">
                    <CardTitle>Filters</CardTitle>
                    <CardDescription>Use any combination of account/card, date range, and custom keywords.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-1.5">
                            <Label>Scope</Label>
                            <Select value={filters.scope} onValueChange={(value) => setFilters((prev) => ({ ...prev, scope: value, sourceId: "all" }))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All sources" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All sources</SelectItem>
                                    <SelectItem value="account">Accounts only</SelectItem>
                                    <SelectItem value="card">Cards only</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Specific source</Label>
                            <Select
                                value={filters.sourceId}
                                onValueChange={(value) => setFilters((prev) => ({ ...prev, sourceId: value }))}
                                disabled={filters.scope === "all"}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={filters.scope === "all" ? "Select scope first" : "All"} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    {availableSources.map((source) => (
                                        <SelectItem key={source.id} value={source.id}>
                                            {source.label} {source.helper ? `(${source.helper})` : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Search keyword</Label>
                            <Input
                                placeholder="Merchant, category, reference..."
                                value={filters.search}
                                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                            />
                        </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-1.5">
                            <Label>Category</Label>
                            <Select
                                value={filters.categoryId}
                                onValueChange={(value) => setFilters((prev) => ({ ...prev, categoryId: value, subCategoryId: "all" }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="All" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    {categories.map((category) => (
                                        <SelectItem key={category.id} value={category.id}>
                                            {category.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Sub category</Label>
                            <Select
                                value={filters.subCategoryId}
                                onValueChange={(value) => setFilters((prev) => ({ ...prev, subCategoryId: value }))}
                                disabled={filters.categoryId === "all"}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={filters.categoryId === "all" ? "Pick a category" : "All"} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    {availableFilterSubCategories.map((sub) => (
                                        <SelectItem key={sub.id} value={sub.id}>
                                            {sub.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Date range</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <Input type="date" value={filters.from} onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))} />
                                <Input type="date" value={filters.to} onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))} />
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button onClick={applyFilters} disabled={loading}>
                            {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Filter
                        </Button>
                        <Button variant="ghost" onClick={resetFilters} disabled={loading}>
                            Reset
                        </Button>
                    </div>
                    {feedback && feedback.type === "error" && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{feedback.message}</AlertDescription>
                        </Alert>
                    )}
                    {feedback && feedback.type === "success" && (
                        <Alert>
                            <CheckCircle2 className="h-4 w-4" />
                            <AlertTitle>Success</AlertTitle>
                            <AlertDescription>{feedback.message}</AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-4">
                    <div className="flex flex-col gap-1">
                        <CardTitle>Approved transactions</CardTitle>
                        <CardDescription>Maximum of 30 rows per page with server-side pagination.</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Source</TableHead>
                                    <TableHead>Merchant</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Booking date</TableHead>
                                    <TableHead>Approved</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transactions.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                                            {loading ? "Loading transactions..." : "Nothing to show yet."}
                                        </TableCell>
                                    </TableRow>
                                )}
                                {transactions.map((record) => (
                                    <TableRow key={record.id}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{resolveSourceLabel(record)}</span>
                                                <span className="text-xs text-muted-foreground capitalize">{record.sourceType}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{record.merchantName || "—"}</span>
                                                <span className="text-xs text-muted-foreground">{record.description || "No description"}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <span>{record.categoryRef?.name || record.category || "—"}</span>
                                                {(record.subCategoryRef?.name || record.subCategory) && (
                                                    <Badge variant="secondary" className="w-fit text-xs">
                                                        {record.subCategoryRef?.name || record.subCategory}
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-semibold">
                                            {formatCurrency(record.amount, record.currency)}
                                        </TableCell>
                                        <TableCell>{formatDate(record.bookingDate)}</TableCell>
                                        <TableCell>
                                            <span className="text-sm text-muted-foreground">{formatDate(record.approvedAt)}</span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => setDialogRecord(record)}>
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="flex flex-wrap items-center justify-between text-sm text-muted-foreground">
                        <span>
                            Showing {(meta.page - 1) * meta.pageSize + 1}-
                            {Math.min(meta.page * meta.pageSize, meta.total)} of {meta.total}
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={meta.page === 1 || loading}
                                onClick={() => fetchTransactions(meta.page - 1)}
                            >
                                Previous
                            </Button>
                            <div className="flex items-center gap-1">
                                {pageItems.map((item, index) =>
                                    typeof item === "string" ? (
                                        <span key={`${item}-${index}`} className="px-2">
                                            …
                                        </span>
                                    ) : (
                                        <Button
                                            key={item}
                                            variant={item === meta.page ? "default" : "outline"}
                                            size="sm"
                                            disabled={loading}
                                            onClick={() => fetchTransactions(item)}
                                        >
                                            {item}
                                        </Button>
                                    )
                                )}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={meta.page >= totalPages || loading}
                                onClick={() => fetchTransactions(meta.page + 1)}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={Boolean(dialogRecord)} onOpenChange={(open) => !open && setDialogRecord(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Transaction details</DialogTitle>
                        <DialogDescription>Snapshot of the approved record.</DialogDescription>
                    </DialogHeader>
                    {dialogRecord && (
                        <div className="space-y-3 text-sm">
                            <div>
                                <p className="text-xs uppercase text-muted-foreground">Source</p>
                                <p>{resolveSourceLabel(dialogRecord)}</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase text-muted-foreground">Merchant</p>
                                <p>{dialogRecord.merchantName || "—"}</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase text-muted-foreground">Description</p>
                                <p>{dialogRecord.description || "—"}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <p className="text-xs uppercase text-muted-foreground">Amount</p>
                                    <p>{formatCurrency(dialogRecord.amount, dialogRecord.currency)}</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase text-muted-foreground">Category</p>
                                    <p>{dialogRecord.categoryRef?.name || dialogRecord.category || "—"}</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase text-muted-foreground">Sub category</p>
                                    <p>{dialogRecord.subCategoryRef?.name || dialogRecord.subCategory || "—"}</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase text-muted-foreground">Booking date</p>
                                    <p>{formatDate(dialogRecord.bookingDate)}</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase text-muted-foreground">Value date</p>
                                    <p>{formatDate(dialogRecord.valueDate)}</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase text-muted-foreground">Approved at</p>
                                    <p>{formatDate(dialogRecord.approvedAt)}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
