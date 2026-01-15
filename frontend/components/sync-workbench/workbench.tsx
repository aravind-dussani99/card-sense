"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Eye, Pencil, Trash2, AlertCircle, CheckCircle2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getApiBaseUrl } from "@/lib/api";

type SourceOption = {
    id: string;
    label: string;
    helper?: string;
    type: "account" | "card";
};

type DraftRecord = {
    id: string;
    merchantTo?: string | null;
    descriptionVia?: string | null;
    subCategory?: string | null;
    amount: number;
    currency?: string | null;
    category?: string | null;
    date: string | null;
    notes?: string | null;
    remarks?: string | null;
    raw?: string | null;
    direction?: string | null;
    account?: { id: string; name: string | null; type: string | null; mask: string | null } | null;
};

type Meta = {
    page: number;
    pageSize: number;
    total: number;
};

type DialogState = {
    mode: "view" | "edit" | "add" | null;
    draft?: DraftRecord;
};

interface SyncWorkbenchProps {
    accounts: SourceOption[];
    cards: SourceOption[];
    initialDrafts: DraftRecord[];
    initialMeta: Meta;
    categories: Array<{
        id: string;
        name: string;
        subCategories: Array<{ id: string; name: string; categoryId: string }>;
    }>;
}

const SYNC_MODES = [
    { value: "all", label: "All accounts & cards" },
    { value: "accounts", label: "All accounts only" },
    { value: "cards", label: "All cards only" },
    { value: "custom", label: "Select individual sources" },
] as const;

const PAGE_SIZE = 15;
type SyncModeOption = (typeof SYNC_MODES)[number]["value"];

export function SyncWorkbench({ accounts, cards, initialDrafts, initialMeta, categories }: SyncWorkbenchProps) {
    const [syncMode, setSyncMode] = useState<SyncModeOption>("all");
    const [selectedSources, setSelectedSources] = useState<string[]>([]);
    const allSources = useMemo(() => [...accounts, ...cards], [accounts, cards]);
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [syncLoading, setSyncLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(false);
    const [drafts, setDrafts] = useState<DraftRecord[]>(initialDrafts);
    const [meta, setMeta] = useState<Meta>(initialMeta);
    const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [dialog, setDialog] = useState<DialogState>({ mode: null });
    const [editForm, setEditForm] = useState({
        merchantName: "",
        amount: "",
        category: "",
        categoryId: "",
        subCategory: "",
        description: "",
        bookingDate: "",
        notes: "",
        remarks: "",
    });
    const [editLoading, setEditLoading] = useState(false);
    const [rowLoadingId, setRowLoadingId] = useState<string | null>(null);
    const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
    const [filterAccountId, setFilterAccountId] = useState<string>("");
    const [filterCategoryId, setFilterCategoryId] = useState<string>("");
    const [filterFromDate, setFilterFromDate] = useState<string>("");
    const [filterToDate, setFilterToDate] = useState<string>("");
    const [showSync, setShowSync] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        if (syncMode !== "custom") {
            setSourcePickerOpen(false);
            if (selectedSources.length) {
                setSelectedSources([]);
            }
        }
    }, [syncMode, selectedSources.length]);

    const totalPages = Math.max(1, Math.ceil(meta.total / meta.pageSize));

    const renderPageButtons = () => {
        const maxButtons = 7;
        const buttons: JSX.Element[] = [];
        let start = Math.max(1, meta.page - 3);
        let end = Math.min(totalPages, start + maxButtons - 1);
        if (end - start < maxButtons - 1) {
            start = Math.max(1, end - maxButtons + 1);
        }

        const addButton = (pageNumber: number, label?: string) => {
            buttons.push(
                <Button
                    key={pageNumber + (label || "")}
                    variant={meta.page === pageNumber ? "default" : "outline"}
                    size="sm"
                    onClick={() => fetchDrafts(pageNumber)}
                    disabled={pageLoading || meta.page === pageNumber}
                >
                    {label || pageNumber}
                </Button>
            );
        };

        if (start > 1) {
            addButton(1);
            if (start > 2) {
                buttons.push(<span key="start-ellipsis" className="px-1 text-xs">…</span>);
            }
        }

        for (let i = start; i <= end; i += 1) {
            addButton(i);
        }

        if (end < totalPages) {
            if (end < totalPages - 1) {
                buttons.push(<span key="end-ellipsis" className="px-1 text-xs">…</span>);
            }
            addButton(totalPages);
        }

        return buttons;
    };

    const mapDraftFromApi = (draft: DraftRecord): DraftRecord => {
        let extra: { notes?: string | null; remarks?: string | null; subCategory?: string | null } = {};
        if (draft.raw) {
            try {
                const parsed = JSON.parse(draft.raw);
                if (parsed && typeof parsed === "object") {
                    extra = {
                        notes: typeof parsed.notes === "string" ? parsed.notes : undefined,
                        remarks: typeof parsed.remarks === "string" ? parsed.remarks : undefined,
                        subCategory: typeof parsed.subCategory === "string" ? parsed.subCategory : undefined,
                    };
                }
            } catch {
                // ignore malformed raw
            }
        }
        return {
            ...draft,
            date: draft.date,
            merchantTo: draft.merchantTo || (draft as any).merchant || draft.descriptionVia || null,
            descriptionVia: draft.descriptionVia || (draft as any).description || (draft as any).merchant || null,
            notes: draft.notes ?? extra.notes ?? null,
            remarks: draft.remarks ?? extra.remarks ?? null,
            subCategory: draft.subCategory ?? extra.subCategory ?? null,
            direction: draft.direction || (draft.amount < 0 ? "debit" : "credit"),
        };
    };

    useEffect(() => {
        setDrafts(initialDrafts.map(mapDraftFromApi));
        setMeta(initialMeta);
    }, [initialDrafts, initialMeta]);

    type DraftListResponse = {
        success: boolean;
        data: DraftRecord[];
        meta: Meta;
        error?: string;
    };

    const readJson = async <T,>(response: Response): Promise<T> => {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            return (await response.json()) as T;
        }
        const fallback = await response.text();
        throw new Error(fallback || "Server returned an unexpected response");
    };

    const categoryLookup = useMemo(() => {
        const map = new Map<string, { id: string; name: string; subCategories: Array<{ id: string; name: string; categoryId: string }> }>();
        categories.forEach((category) => map.set(category.id, category));
        return map;
    }, [categories]);

    const availableEditSubCategories = useMemo(() => {
        if (!editForm.categoryId) return [];
        return categoryLookup.get(editForm.categoryId)?.subCategories ?? [];
    }, [categoryLookup, editForm.categoryId]);

    const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong");

    const fetchDrafts = async (
        page: number,
        desiredPageSize = PAGE_SIZE,
        accountIdOverride?: string,
        term?: string,
        categoryOverride?: string,
        fromDateOverride?: string,
        toDateOverride?: string,
    ) => {
        setPageLoading(true);
        setFeedback(null);
        try {
            const params = new URLSearchParams({
                page: String(page),
                pageSize: String(desiredPageSize),
            });
            const accountFilter = accountIdOverride ?? filterAccountId;
            const catValue = categoryOverride ?? filterCategoryId;
            const fromDateValue = fromDateOverride ?? filterFromDate;
            const toDateValue = toDateOverride ?? filterToDate;

            if (accountFilter) {
                params.set("accountId", accountFilter);
            }
            if (term !== undefined) {
                if (term) params.set("search", term);
            } else if (searchTerm) {
                params.set("search", searchTerm);
            }
            if (catValue) params.set("categoryId", catValue);
            if (fromDateValue) params.set("fromDate", fromDateValue);
            if (toDateValue) params.set("toDate", toDateValue);
            const response = await fetch(`${getApiBaseUrl()}/api/sync-workbench/drafts?${params.toString()}`, {
                cache: "no-store",
            });
            const data = await readJson<DraftListResponse>(response);
            if (!response.ok || !data.success) {
                throw new Error(data.error || "Failed to load transactions");
            }

            setDrafts(data.data.map(mapDraftFromApi));
            setMeta(data.meta);
        } catch (error: unknown) {
            setFeedback({ type: "error", message: getErrorMessage(error) || "Failed to load transactions" });
        } finally {
            setPageLoading(false);
        }
    };

    const applyFilters = () => {
        void fetchDrafts(1, PAGE_SIZE);
    };

    const resetFilters = () => {
        setFilterAccountId("");
        setFilterCategoryId("");
        setFilterFromDate("");
        setFilterToDate("");
        setSearchTerm("");
        void fetchDrafts(1, PAGE_SIZE, "", "", "", "");
    };

    const handleSync = async () => {
        if (syncMode === "custom" && selectedSources.length === 0) {
            setFeedback({ type: "error", message: "Select at least one account or card." });
            return;
        }
        setSyncLoading(true);
        setFeedback(null);
        try {
            let accountId: string | undefined;
            if (syncMode === "custom" && selectedSources.length === 1) {
                const [stype, sid] = selectedSources[0].split(":");
                if (stype === "account" && sid) {
                    accountId = sid;
                }
            }

            const payload = {
                accountId,
                fromDate: fromDate || undefined,
                toDate: toDate || undefined,
            };
            const response = await fetch(`${getApiBaseUrl()}/api/bank/sync`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const result = await readJson<{ success: boolean; synced?: number; error?: string }>(response);
            if (!response.ok || !result.success) {
                throw new Error(result.error || "Sync failed");
            }
            setFeedback({
                type: "success",
                message: `Synced ${result.synced ?? 0} connection${result.synced === 1 ? "" : "s"}.`,
            });
            await fetchDrafts(1);
        } catch (error: unknown) {
            setFeedback({ type: "error", message: getErrorMessage(error) || "Sync failed" });
        } finally {
            setSyncLoading(false);
        }
    };

    const handleRowDelete = async (id: string) => {
        setRowLoadingId(id);
        setFeedback(null);
        try {
            const response = await fetch(`${getApiBaseUrl()}/api/sync-workbench/drafts/${id}`, { method: "DELETE" });
            const data = await readJson<{ success: boolean; error?: string }>(response);
            if (!response.ok || !data.success) throw new Error(data.error || "Delete failed");
            const nextTotal = Math.max(0, meta.total - 1);
            const nextPage = Math.min(meta.page, Math.max(1, Math.ceil(nextTotal / meta.pageSize)));
            await fetchDrafts(nextPage);
            setFeedback({ type: "success", message: "Transaction removed. It will reappear on the next sync if still present at source." });
        } catch (error: unknown) {
            setFeedback({ type: "error", message: getErrorMessage(error) || "Delete failed" });
        } finally {
            setRowLoadingId(null);
        }
    };

    const handleApprove = async (id: string) => {
        setRowLoadingId(id);
        setFeedback(null);
        try {
            const response = await fetch(`${getApiBaseUrl()}/api/sync-workbench/drafts/${id}/approve`, {
                method: "POST",
            });
            const data = await readJson<{ success: boolean; error?: string }>(response);
            if (!response.ok || !data.success) throw new Error(data.error || "Approve failed");
            await fetchDrafts(meta.page);
            setFeedback({ type: "success", message: "Transaction approved and saved to ledger." });
        } catch (error: unknown) {
            setFeedback({ type: "error", message: getErrorMessage(error) || "Approve failed" });
        } finally {
            setRowLoadingId(null);
        }
    };

    const openDialog = (mode: "view" | "edit" | "add", draft?: DraftRecord) => {
        setDialog({ mode, draft });
        setFeedback(null);
        if (mode === "edit" && draft) {
            const matchedCategory = categories.find((c) => c.name === draft.category);
            setEditForm({
                merchantName: draft.merchantTo || "",
                amount: draft.amount?.toString() || "",
                category: matchedCategory?.name || "",
                categoryId: matchedCategory?.id || "",
                subCategory: draft.subCategory || "",
                description: draft.descriptionVia || draft.merchantTo || "",
                bookingDate: draft.date ? draft.date.substring(0, 10) : "",
                notes: draft.notes || "",
                remarks: draft.remarks || "",
            });
        }
        if (mode === "add") {
            setEditForm({
                merchantName: "",
                amount: "",
                category: "",
                categoryId: "",
                subCategory: "",
                description: "",
                bookingDate: "",
                notes: "",
                remarks: "",
            });
        }
    };

    const closeDialog = () => {
        setDialog({ mode: null });
        setEditForm({
            merchantName: "",
            amount: "",
            category: "",
            categoryId: "",
            subCategory: "",
            description: "",
            bookingDate: "",
            notes: "",
            remarks: "",
        });
        setEditLoading(false);
    };

    const handleCategorySelection = (value: string) => {
        if (value === "none") {
            setEditForm((prev) => ({ ...prev, categoryId: "", category: "", subCategory: "" }));
            return;
        }
        const cat = categoryLookup.get(value);
        setEditForm((prev) => ({
            ...prev,
            categoryId: value,
            category: cat?.name || "",
            subCategory: "",
        }));
    };

    const handleSubCategorySelection = (value: string) => {
        if (value === "none") {
            setEditForm((prev) => ({ ...prev, subCategory: "" }));
            return;
        }
        setEditForm((prev) => ({ ...prev, subCategory: value }));
    };

    const buildRawPayload = (subCategory?: string, notes?: string, remarks?: string) => {
        const payload: Record<string, string> = {};
        if (subCategory) payload.subCategory = subCategory;
        if (notes) payload.notes = notes;
        if (remarks) payload.remarks = remarks;
        return Object.keys(payload).length ? JSON.stringify(payload) : null;
    };

    const submitEdit = async () => {
        if (!dialog.draft) return;
        setEditLoading(true);
        setFeedback(null);
        try {
            const categoryName = editForm.categoryId ? categoryLookup.get(editForm.categoryId)?.name : editForm.category || undefined;
            const payload = {
                merchantTo: editForm.merchantName || undefined,
                amount: editForm.amount ? Number(editForm.amount) : undefined,
                category: categoryName || undefined,
                descriptionVia: editForm.description || editForm.merchantName || undefined,
                raw: buildRawPayload(editForm.subCategory, editForm.notes, editForm.remarks),
            };
            const response = await fetch(`${getApiBaseUrl()}/api/sync-workbench/drafts/${dialog.draft.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await readJson<{ success: boolean; data: DraftRecord; error?: string }>(response);
            if (!response.ok || !data.success) throw new Error(data.error || "Update failed");
            setDrafts((prev) => prev.map((draft) => (draft.id === dialog.draft?.id ? mapDraftFromApi(data.data) : draft)));
            setFeedback({ type: "success", message: "Transaction updated." });
            closeDialog();
        } catch (error: unknown) {
            setFeedback({ type: "error", message: getErrorMessage(error) || "Update failed" });
            setEditLoading(false);
        }
    };

    const submitAdd = async () => {
        setEditLoading(true);
        setFeedback(null);
        try {
            const categoryName = editForm.categoryId ? categoryLookup.get(editForm.categoryId)?.name : editForm.category || null;
            const payload: Record<string, unknown> = {
                merchantTo: editForm.merchantName || null,
                amount: editForm.amount ? Number(editForm.amount) : 0,
                category: categoryName || null,
                descriptionVia: editForm.description || editForm.merchantName || null,
                date: editForm.bookingDate || new Date().toISOString().substring(0, 10),
                raw: buildRawPayload(editForm.subCategory || undefined, editForm.notes || undefined, editForm.remarks || undefined),
            };
            const response = await fetch(`${getApiBaseUrl()}/api/sync-workbench/drafts`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await readJson<{ success: boolean; data: DraftRecord; error?: string }>(response);
            if (!response.ok || !data.success) throw new Error(data.error || "Create failed");
            setFeedback({ type: "success", message: "Transaction added." });
            closeDialog();
            void fetchDrafts(1);
        } catch (error: unknown) {
            setFeedback({ type: "error", message: getErrorMessage(error) || "Create failed" });
        } finally {
            setEditLoading(false);
        }
    };

    const isValidMode = (value: string): value is SyncModeOption => SYNC_MODES.some((mode) => mode.value === value);

    const formatCurrency = (amount: number, currency?: string | null) => {
        try {
            return new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: currency || "USD",
                minimumFractionDigits: 2,
            }).format(amount || 0);
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

    const renderSourceLabel = (draft: DraftRecord) => {
        const name = draft.account?.name || draft.account?.type || "Account";
        const helperAcct = draft.account?.mask ? `••${draft.account.mask}` : draft.account?.type || "";
        return `${name}${helperAcct ? ` (${helperAcct})` : ""}`;
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="pb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle>Sync configuration</CardTitle>
                        <CardDescription>Choose sources and date boundaries. Each sync writes into the new transactions store.</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setShowSync((prev) => !prev)}>
                        {showSync ? "Hide sync" : "Show sync"}
                    </Button>
                </CardHeader>
                {showSync && (
                    <CardContent className="space-y-3">
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                            <div className="space-y-1">
                                <Label>Source scope</Label>
                                <Select value={syncMode} onValueChange={(value) => isValidMode(value) && setSyncMode(value)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select scope" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SYNC_MODES.map((mode) => (
                                            <SelectItem key={mode.value} value={mode.value}>
                                                {mode.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>Custom selection</Label>
                                <Popover open={sourcePickerOpen} onOpenChange={(open) => syncMode === "custom" && setSourcePickerOpen(open)}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            disabled={syncMode !== "custom"}
                                            className="w-full justify-between"
                                        >
                                            {selectedSources.length === 0
                                                ? "Pick specific accounts or cards"
                                                : `${selectedSources.length} source${selectedSources.length === 1 ? "" : "s"} selected`}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent align="start" className="w-[320px] space-y-3">
                                        <div className="text-sm font-medium">Select accounts or cards</div>
                                            <div className="max-h-60 space-y-2 overflow-y-auto pr-2">
                                            {allSources.map((source) => {
                                                const value = `${source.type}:${source.id}`;
                                                const checked = selectedSources.includes(value);
                                                return (
                                                    <label
                                                        key={value}
                                                        className="flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            className="mt-1 h-4 w-4 rounded border-slate-300"
                                                            checked={checked}
                                                            onChange={() => {
                                                                setSelectedSources((prev) =>
                                                                    checked ? prev.filter((item) => item !== value) : [...prev, value]
                                                                );
                                                            }}
                                                        />
                                                        <span className="flex flex-col">
                                                            <span className="font-medium">{source.label}</span>
                                                            <span className="text-xs text-muted-foreground capitalize">
                                                                {source.type}
                                                                {source.helper ? ` • ${source.helper}` : ""}
                                                            </span>
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                            {allSources.length === 0 && (
                                                <p className="text-sm text-muted-foreground">No sources connected yet.</p>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <button
                                                type="button"
                                                className="font-medium hover:text-slate-900"
                                                onClick={() => setSelectedSources([])}
                                            >
                                                Clear selection
                                            </button>
                                            <Button type="button" size="sm" onClick={() => setSourcePickerOpen(false)}>
                                                Done
                                            </Button>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="fromDate">From date</Label>
                                <Input id="fromDate" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="toDate">To date</Label>
                                <Input id="toDate" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button onClick={handleSync} disabled={syncLoading}>
                                {syncLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                Sync from bank
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => { setFromDate(""); setToDate(""); }}>
                                Clear dates
                            </Button>
                        </div>
                        {feedback && feedback.type === "success" && (
                            <Alert>
                                <CheckCircle2 className="h-4 w-4" />
                                <AlertTitle>Success</AlertTitle>
                                <AlertDescription>{feedback.message}</AlertDescription>
                            </Alert>
                        )}
                        {feedback && feedback.type === "error" && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{feedback.message}</AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                )}
            </Card>

            <Card>
                <CardHeader className="pb-4">
                    <CardTitle>Filters</CardTitle>
                    <CardDescription>Use account, date, category, and keywords to narrow results.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-1.5">
                            <Label>Search keyword</Label>
                            <Input
                                placeholder="Merchant or description..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        applyFilters();
                                    }
                                }}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Accounts / Cards</Label>
                            <Select
                                value={filterAccountId || "all"}
                                onValueChange={(val) => setFilterAccountId(val === "all" ? "" : val)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="All sources" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All sources</SelectItem>
                                    {accounts.map((source) => (
                                        <SelectItem key={source.id} value={source.id}>
                                            {source.label} {source.helper ? `(${source.helper})` : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Category</Label>
                            <Select
                                value={filterCategoryId || "all"}
                                onValueChange={(val) => {
                                    if (val === "all") {
                                        setFilterCategoryId("");
                                    } else {
                                        setFilterCategoryId(val);
                                    }
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="All" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    {categories.map((category) => (
                                        <SelectItem key={category.id} value={category.name}>
                                            {category.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Date range</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <Input type="date" value={filterFromDate} onChange={(e) => setFilterFromDate(e.target.value)} />
                                <Input type="date" value={filterToDate} onChange={(e) => setFilterToDate(e.target.value)} />
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <Button onClick={applyFilters}>Filter</Button>
                        <Button variant="ghost" onClick={resetFilters}>Reset</Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-4">
                    <div className="flex flex-col gap-1">
                        <CardTitle>Transactions</CardTitle>
                        <CardDescription>Everything fetched via the sync button lands here. Review 15 rows at a time.</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-col">
                            <CardTitle className="text-lg">Transactions</CardTitle>
                            <CardDescription>Edit or review synced items. Deleting is allowed only for cash entries.</CardDescription>
                        </div>
                        <Button size="sm" onClick={() => openDialog("add")}>
                            + Add transaction
                        </Button>
                    </div>

                    <div className="rounded-md border overflow-hidden">
                        <div className="relative max-h-[640px] overflow-auto">
                        <Table className="text-sm">
                            <TableHeader className="sticky top-0 z-20 bg-white shadow-sm">
                                <TableRow>
                                    <TableHead className="sticky top-0 bg-white z-20">Source</TableHead>
                                    <TableHead className="sticky top-0 bg-white z-20">Merchant</TableHead>
                                    <TableHead className="sticky top-0 bg-white z-20">Type</TableHead>
                                    <TableHead className="sticky top-0 bg-white z-20">Category</TableHead>
                                    <TableHead className="sticky top-0 bg-white z-20">Amount</TableHead>
                                    <TableHead className="sticky top-0 bg-white z-20">Date</TableHead>
                                    <TableHead className="sticky top-0 bg-white z-20 text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {drafts.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                                            {pageLoading ? "Loading transactions..." : "No transactions yet. Run a sync to populate this table."}
                                        </TableCell>
                                    </TableRow>
                                )}
                                {drafts.map((draft) => (
                                    <TableRow key={draft.id} className="align-middle">
                                        <TableCell className="py-2">
                                            <div className="flex flex-col">
                                                <span className="font-medium">{renderSourceLabel(draft)}</span>
                                                <span className="text-xs text-muted-foreground capitalize">{draft.account?.type || "account"}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-2">
                                            <div className="flex flex-col">
                                                <span className="font-medium">{draft.merchantTo || draft.descriptionVia || "—"}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {draft.descriptionVia || draft.merchantTo || "No description"}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-2">
                                            <span className="text-xs font-medium uppercase text-muted-foreground">
                                                {draft.amount < 0 ? "Debit" : "Credit"}
                                            </span>
                                        </TableCell>
                                        <TableCell className="py-2">
                                            <div className="flex flex-col gap-1">
                                                <span>{draft.category || "—"}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-semibold py-2">
                                            {formatCurrency(draft.amount, draft.currency || "USD")}
                                        </TableCell>
                                        <TableCell className="py-2">
                                            <div className="flex flex-col">
                                                <span>{formatDate(draft.date)}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right space-x-1 py-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                disabled={rowLoadingId === draft.id}
                                                onClick={() => handleApprove(draft.id)}
                                                title="Approve"
                                            >
                                                {rowLoadingId === draft.id ? (
                                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Check className="h-4 w-4" />
                                                )}
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => openDialog("view", draft)}>
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => openDialog("edit", draft)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                disabled={rowLoadingId === draft.id}
                                                onClick={() => handleRowDelete(draft.id)}
                                            >
                                                {rowLoadingId === draft.id ? (
                                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-sm text-muted-foreground">
                        <span>
                            {meta.total === 0
                                ? "Showing 0 of 0"
                                : `Showing ${(meta.page - 1) * meta.pageSize + 1}-${Math.min(meta.page * meta.pageSize, meta.total)} of ${meta.total}`}
                        </span>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={meta.page === 1 || pageLoading}
                                onClick={() => fetchDrafts(meta.page - 1)}
                            >
                                Previous
                            </Button>
                            {renderPageButtons()}
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={meta.page >= totalPages || pageLoading}
                                onClick={() => fetchDrafts(meta.page + 1)}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={dialog.mode !== null} onOpenChange={(open) => !open && closeDialog()}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {dialog.mode === "view" ? "Transaction details" : dialog.mode === "add" ? "Add cash transaction" : "Edit transaction"}
                        </DialogTitle>
                        <DialogDescription>
                            {dialog.mode === "view"
                                ? "Full transaction fields."
                                : dialog.mode === "add"
                                    ? "Capture a cash transaction."
                                    : "Update the necessary fields."}
                        </DialogDescription>
                    </DialogHeader>
                    {dialog.mode === "view" && dialog.draft && (
                        <div className="space-y-4 text-sm">
                            <div className="grid gap-3 md:grid-cols-2">
                                <div>
                                    <p className="text-xs uppercase text-muted-foreground">Source</p>
                                    <p className="font-semibold">{renderSourceLabel(dialog.draft)}</p>
                                    <p className="text-xs text-muted-foreground capitalize">{dialog.draft.account?.type || "account"}</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase text-muted-foreground">Merchant</p>
                                    <p className="font-semibold">{dialog.draft.merchantTo || dialog.draft.descriptionVia || "—"}</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase text-muted-foreground">Description</p>
                                    <p>{dialog.draft.descriptionVia || dialog.draft.merchantTo || "—"}</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase text-muted-foreground">Category</p>
                                    <p>{dialog.draft.category || "—"}</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase text-muted-foreground">Sub-category</p>
                                    <p>{dialog.draft.subCategory || "—"}</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase text-muted-foreground">Amount</p>
                                    <p>{formatCurrency(dialog.draft.amount, dialog.draft.currency)}</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase text-muted-foreground">Currency</p>
                                    <p>{dialog.draft.currency || "—"}</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase text-muted-foreground">Direction</p>
                                    <p>—</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase text-muted-foreground">Date</p>
                                    <p>{formatDate(dialog.draft.date)}</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase text-muted-foreground">Reference</p>
                                    <p>—</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase text-muted-foreground">Provider transaction id</p>
                                    <p>{dialog.draft.id}</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <p className="text-xs uppercase text-muted-foreground">Notes</p>
                                <p>{dialog.draft.notes || "—"}</p>
                            </div>
                            <div className="space-y-2">
                                <p className="text-xs uppercase text-muted-foreground">Remarks</p>
                                <p>{dialog.draft.remarks || "—"}</p>
                            </div>
                        </div>
                    )}
                    {(dialog.mode === "edit" || dialog.mode === "add") && (
                        <div className="space-y-3">
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label>Merchant</Label>
                                    <Input value={editForm.merchantName} onChange={(e) => setEditForm((prev) => ({ ...prev, merchantName: e.target.value }))} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Amount</Label>
                                    <Input type="number" value={editForm.amount} onChange={(e) => setEditForm((prev) => ({ ...prev, amount: e.target.value }))} />
                                </div>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label>Category</Label>
                                    <Select
                                        value={editForm.categoryId || "none"}
                                        onValueChange={handleCategorySelection}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Unassigned</SelectItem>
                                            {categories.map((category) => (
                                                <SelectItem key={category.id} value={category.id}>
                                                    {category.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Sub-category</Label>
                                    <Select
                                        value={editForm.subCategory || "none"}
                                        onValueChange={handleSubCategorySelection}
                                        disabled={!editForm.categoryId}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={editForm.categoryId ? "Select sub-category" : "Pick a category first"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Unassigned</SelectItem>
                                            {availableEditSubCategories.map((sub) => (
                                                <SelectItem key={sub.id} value={sub.name}>
                                                    {sub.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Date</Label>
                                <Input
                                    type="date"
                                    value={editForm.bookingDate}
                                    disabled={dialog.mode === "edit"}
                                    onChange={(e) => setEditForm((prev) => ({ ...prev, bookingDate: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Description / via</Label>
                                <Textarea rows={3} value={editForm.description} disabled />
                                <p className="text-xs text-muted-foreground">Description is copied from the source and not editable; update the Merchant to override who it is actually for.</p>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Notes</Label>
                                <Textarea rows={3} value={editForm.notes} onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Remarks</Label>
                                <Textarea rows={3} value={editForm.remarks} onChange={(e) => setEditForm((prev) => ({ ...prev, remarks: e.target.value }))} />
                            </div>
                            <DialogFooter>
                                <Button variant="ghost" onClick={closeDialog}>
                                    Cancel
                                </Button>
                                {dialog.mode === "edit" ? (
                                    <Button onClick={submitEdit} disabled={editLoading}>
                                        {editLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Save changes
                                    </Button>
                                ) : (
                                    <Button onClick={submitAdd} disabled={editLoading}>
                                        {editLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Add transaction
                                    </Button>
                                )}
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
