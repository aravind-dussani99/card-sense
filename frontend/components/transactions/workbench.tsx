"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, AlertCircle, CheckCircle2, Eye, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { getMonthToDateRange } from "@/lib/utils";

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
    merchant?: string | null;
    description?: string | null;
    subCategory?: string | null;
    amount: number;
    currency?: string | null;
    category?: string | null;
    date: string | null;
    remarks?: string | null;
    raw?: string | null;
    direction?: string | null;
    providerTransactionId?: string | null;
    runningBalance?: number | null;
    openingBalance?: number | null;
    closingBalance?: number | null;
    fromEntity?: string | null;
    viaEntity?: string | null;
    toEntity?: string | null;
    headAccount?: string | null;
    attachments?: string[];
    comments?: string | null;
    account?: { id: string; name: string | null; type: string | null; mask: string | null } | null;
    meta?: {
        openingBalance?: number | null;
        closingBalance?: number | null;
        fromEntity?: string | null;
        viaEntity?: string | null;
        toEntity?: string | null;
        headAccount?: string | null;
        subCategory?: string | null;
        remarks?: string | null;
        comments?: string | null;
        attachmentsJson?: string | null;
    } | null;
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

interface TransactionsWorkbenchProps {
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

export function TransactionsWorkbench({ accounts, cards, initialDrafts, initialMeta, categories }: TransactionsWorkbenchProps) {
    const monthToDate = useMemo(() => getMonthToDateRange(), []);
    const [syncMode, setSyncMode] = useState<SyncModeOption>("all");
    const [selectedSources, setSelectedSources] = useState<string[]>([]);
    const allSources = useMemo(() => [...accounts, ...cards], [accounts, cards]);
    const [fromDate, setFromDate] = useState(monthToDate.from);
    const [toDate, setToDate] = useState(monthToDate.to);
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
        headAccount: "",
        openingBalance: "",
        closingBalance: "",
        fromEntity: "",
        viaEntity: "",
        toEntity: "",
        attachments: "",
        description: "",
        remarks: "",
        comments: "",
        bookingDate: "",
    });
    const [editLoading, setEditLoading] = useState(false);
    const [rowLoadingId, setRowLoadingId] = useState<string | null>(null);
    const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
    const [filterAccountId, setFilterAccountId] = useState<string>("");
    const [filterCategoryId, setFilterCategoryId] = useState<string>("");
    const [filterFromDate, setFilterFromDate] = useState<string>(monthToDate.from);
    const [filterToDate, setFilterToDate] = useState<string>(monthToDate.to);
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


    const buildAccountLabel = useCallback((item: DraftRecord) => {
        const name = item.account?.name || item.account?.type || "Account";
        const helper = item.account?.mask ? `••${item.account.mask}` : item.account?.type || "";
        return `${name}${helper ? ` (${helper})` : ""}`;
    }, []);

    const mapDraftFromApi = useCallback((draft: DraftRecord): DraftRecord => {
        let extra: { remarks?: string | null; subCategory?: string | null } = {};
        if (draft.raw) {
            try {
                const parsed = JSON.parse(draft.raw);
                if (parsed && typeof parsed === "object") {
                    extra = {
                        remarks: typeof parsed.remarks === "string" ? parsed.remarks : undefined,
                        subCategory: typeof parsed.subCategory === "string" ? parsed.subCategory : undefined,
                    };
                }
            } catch {
                // ignore malformed raw
            }
        }
        let attachments: string[] = [];
        if (draft.meta?.attachmentsJson) {
            try {
                const parsed = JSON.parse(draft.meta.attachmentsJson);
                attachments = Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
            } catch {
                attachments = [];
            }
        }
        const sourceLabel = buildAccountLabel(draft);
        const merchantLabel = draft.merchant || draft.merchantTo || draft.descriptionVia || null;
        const isOutflow = draft.amount < 0;
        const derivedFrom = isOutflow ? sourceLabel : merchantLabel || sourceLabel;
        const derivedTo = isOutflow ? merchantLabel || sourceLabel : sourceLabel;
        const closingBalance =
            draft.meta?.closingBalance ??
            (draft.runningBalance !== undefined && draft.runningBalance !== null ? draft.runningBalance : null);
        const openingBalance =
            draft.meta?.openingBalance ??
            (closingBalance !== null && closingBalance !== undefined ? closingBalance - draft.amount : null);
        return {
            ...draft,
            date: draft.date,
            merchantTo: draft.merchantTo || draft.merchant || draft.descriptionVia || null,
            descriptionVia: draft.descriptionVia || draft.description || draft.merchant || null,
            remarks: draft.meta?.remarks ?? draft.remarks ?? extra.remarks ?? null,
            subCategory: draft.meta?.subCategory ?? draft.subCategory ?? extra.subCategory ?? null,
            direction: draft.direction || (draft.amount < 0 ? "debit" : "credit"),
            openingBalance,
            closingBalance,
            fromEntity: draft.meta?.fromEntity ?? derivedFrom ?? null,
            viaEntity: draft.meta?.viaEntity ?? null,
            toEntity: draft.meta?.toEntity ?? derivedTo ?? null,
            headAccount: draft.meta?.headAccount ?? null,
            attachments,
            comments: draft.meta?.comments ?? null,
        };
    }, [buildAccountLabel]);

    const totalPages = Math.max(1, Math.ceil(meta.total / meta.pageSize));

    const renderPageButtons = () => {
        const maxButtons = 5;
        const buttons: JSX.Element[] = [];
        let start = Math.max(1, meta.page - 2);
        let end = Math.min(totalPages, start + maxButtons - 1);
        if (end - start < maxButtons - 1) {
            start = Math.max(1, end - maxButtons + 1);
            end = Math.min(totalPages, start + maxButtons - 1);
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

    const fetchDrafts = useCallback(async (
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
            const response = await fetch(`${getApiBaseUrl()}/api/transactions/drafts?${params.toString()}`, {
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
    }, [filterAccountId, filterCategoryId, filterFromDate, filterToDate, mapDraftFromApi, searchTerm]);

    useEffect(() => {
        setDrafts(initialDrafts.map(mapDraftFromApi));
        setMeta(initialMeta);
    }, [initialDrafts, initialMeta, mapDraftFromApi]);

    useEffect(() => {
        void fetchDrafts(1, PAGE_SIZE);
    }, [fetchDrafts]);

    const applyFilters = () => {
        void fetchDrafts(1, PAGE_SIZE);
    };

    const resetFilters = () => {
        const range = getMonthToDateRange();
        setFilterAccountId("");
        setFilterCategoryId("");
        setFilterFromDate(range.from);
        setFilterToDate(range.to);
        setSearchTerm("");
        void fetchDrafts(1, PAGE_SIZE, "", "", "", range.from, range.to);
    };

    const resetSyncConfig = () => {
        const range = getMonthToDateRange();
        setSyncMode("all");
        setSelectedSources([]);
        setFromDate(range.from);
        setToDate(range.to);
        setSourcePickerOpen(false);
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
            const response = await fetch(`${getApiBaseUrl()}/api/transactions/drafts/${id}`, { method: "DELETE" });
            const data = await readJson<{ success: boolean; error?: string }>(response);
            if (!response.ok || !data.success) throw new Error(data.error || "Delete failed");
            await fetchDrafts(1);
            setFeedback({ type: "success", message: "Cash transaction deleted." });
        } catch (error: unknown) {
            setFeedback({ type: "error", message: getErrorMessage(error) || "Delete failed" });
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
                headAccount: draft.headAccount || "",
                openingBalance: draft.openingBalance !== null && draft.openingBalance !== undefined ? String(draft.openingBalance) : "",
                closingBalance: draft.closingBalance !== null && draft.closingBalance !== undefined ? String(draft.closingBalance) : "",
                fromEntity: draft.fromEntity || "",
                viaEntity: draft.viaEntity || "",
                toEntity: draft.toEntity || "",
                attachments: draft.attachments?.join(", ") || "",
                description: draft.descriptionVia || draft.merchantTo || "",
                remarks: draft.remarks || "",
                comments: draft.comments || "",
                bookingDate: draft.date ? draft.date.substring(0, 10) : "",
            });
        }
        if (mode === "add") {
            setEditForm({
                merchantName: "",
                amount: "",
                category: "",
                categoryId: "",
                subCategory: "",
                headAccount: "",
                openingBalance: "",
                closingBalance: "",
                fromEntity: "",
                viaEntity: "",
                toEntity: "",
                attachments: "",
                description: "",
                remarks: "",
                comments: "",
                bookingDate: "",
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
            headAccount: "",
            openingBalance: "",
            closingBalance: "",
            fromEntity: "",
            viaEntity: "",
            toEntity: "",
            attachments: "",
            description: "",
            remarks: "",
            comments: "",
            bookingDate: "",
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

    const submitEdit = async () => {
        if (!dialog.draft) return;
        if (!editForm.headAccount.trim()) {
            setFeedback({ type: "error", message: "Head Account is required." });
            return;
        }
        setEditLoading(true);
        setFeedback(null);
        try {
            const categoryName = editForm.categoryId ? categoryLookup.get(editForm.categoryId)?.name : editForm.category || undefined;
            const payload = {
                merchantTo: editForm.merchantName || undefined,
                amount: editForm.amount ? Number(editForm.amount) : undefined,
                category: categoryName || undefined,
                descriptionVia: editForm.description || editForm.merchantName || undefined,
                subCategory: editForm.subCategory || undefined,
                headAccount: editForm.headAccount || undefined,
                openingBalance: editForm.openingBalance ? Number(editForm.openingBalance) : undefined,
                closingBalance: editForm.closingBalance ? Number(editForm.closingBalance) : undefined,
                fromEntity: editForm.fromEntity || undefined,
                viaEntity: editForm.viaEntity || undefined,
                toEntity: editForm.toEntity || undefined,
                remarks: editForm.remarks || undefined,
                comments: editForm.comments || undefined,
                attachments: editForm.attachments || undefined,
            };
            const response = await fetch(`${getApiBaseUrl()}/api/transactions/drafts/${dialog.draft.id}`, {
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
        if (!editForm.headAccount.trim()) {
            setFeedback({ type: "error", message: "Head Account is required." });
            return;
        }
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
                subCategory: editForm.subCategory || null,
                headAccount: editForm.headAccount || null,
                openingBalance: editForm.openingBalance ? Number(editForm.openingBalance) : null,
                closingBalance: editForm.closingBalance ? Number(editForm.closingBalance) : null,
                fromEntity: editForm.fromEntity || null,
                viaEntity: editForm.viaEntity || null,
                toEntity: editForm.toEntity || null,
                remarks: editForm.remarks || null,
                comments: editForm.comments || null,
                attachments: editForm.attachments || null,
            };
            const response = await fetch(`${getApiBaseUrl()}/api/transactions/drafts`, {
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

    const renderSourceLabel = (draft: DraftRecord) => buildAccountLabel(draft);

    const isCashTransaction = (draft: DraftRecord) =>
        typeof draft.providerTransactionId === "string" && draft.providerTransactionId.startsWith("manual-");

    const [syncDialogOpen, setSyncDialogOpen] = useState(false);
    const [filterDialogOpen, setFilterDialogOpen] = useState(false);
    const showInlinePanels = false;

    useEffect(() => {
        const openSync = () => setSyncDialogOpen(true);
        const openFilter = () => setFilterDialogOpen(true);
        window.addEventListener("open-sync-dialog", openSync);
        window.addEventListener("open-filter-dialog", openFilter);
        return () => {
            window.removeEventListener("open-sync-dialog", openSync);
            window.removeEventListener("open-filter-dialog", openFilter);
        };
    }, []);

    return (
        <div className="space-y-6">
            {showInlinePanels && (
                <div className="space-y-4">
                <Card className="w-full">
                    <CardHeader className="pb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle>Sync new transactions</CardTitle>
                            <CardDescription className="text-xs">
                                Choose sources + dates, then sync the latest data.
                            </CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setShowSync((prev) => !prev)}>
                            {showSync ? "Hide sync" : "Show sync"}
                        </Button>
                    </CardHeader>
                    {showSync && (
                        <CardContent className="pt-0">
                            <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr_0.9fr_0.9fr_auto]">
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
                                                <Button type="button" size="sm" variant="outline" onClick={() => setSelectedSources([])}>
                                                    Clear selection
                                                </Button>
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
                                <div className="flex items-end gap-2">
                                    <Button onClick={handleSync} disabled={syncLoading} className="whitespace-nowrap">
                                        {syncLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                        Sync latest/new transactions
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={resetSyncConfig}>
                                        Reset
                                    </Button>
                                </div>
                            </div>
                            {feedback && feedback.type === "success" && (
                                <Alert className="mt-3">
                                    <CheckCircle2 className="h-4 w-4" />
                                    <AlertTitle>Success</AlertTitle>
                                    <AlertDescription>{feedback.message}</AlertDescription>
                                </Alert>
                            )}
                            {feedback && feedback.type === "error" && (
                                <Alert variant="destructive" className="mt-3">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>Error</AlertTitle>
                                    <AlertDescription>{feedback.message}</AlertDescription>
                                </Alert>
                            )}
                        </CardContent>
                    )}
                </Card>

                <Card className="w-full">
                    <CardHeader className="pb-2 flex flex-col gap-1">
                        <CardTitle>Filters</CardTitle>
                        <CardDescription className="text-xs">Filter by account, date, category, or keyword.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="grid gap-3 lg:grid-cols-[1fr_0.9fr_1.1fr_0.9fr_auto]">
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
                                <Label>Date range</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <Input type="date" value={filterFromDate} onChange={(e) => setFilterFromDate(e.target.value)} />
                                    <Input type="date" value={filterToDate} onChange={(e) => setFilterToDate(e.target.value)} />
                                </div>
                            </div>
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
                            <div className="flex items-end gap-2">
                                <Button onClick={applyFilters}>Filter</Button>
                                <Button variant="outline" onClick={resetFilters}>Reset</Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
            )}

            <Card>
                <CardHeader className="pb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex flex-col gap-1">
                        <CardTitle>Transactions</CardTitle>
                        <CardDescription>
                            Sync and filter transactions from the page header, then review and edit results here. Deleting is allowed only for cash entries.
                        </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                            <Button size="sm" onClick={() => openDialog("add")}>
                                + Add Cash Transaction
                            </Button>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={meta.page === 1 || pageLoading}
                                onClick={() => fetchDrafts(meta.page - 1)}
                            >
                                Previous
                            </Button>
                            <div className="flex items-center gap-1">
                                {renderPageButtons()}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={meta.page >= totalPages || pageLoading}
                                onClick={() => fetchDrafts(meta.page + 1)}
                            >
                                Next
                            </Button>
                            <span className="ml-2 text-sm text-muted-foreground">
                                Showing {drafts.length} item{drafts.length === 1 ? "" : "s"} (total {meta.total})
                            </span>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {pageLoading && (
                        <p className="text-xs text-muted-foreground">Refreshing transactions...</p>
                    )}
                    <div className="rounded-2xl border border-slate-200 bg-white">
                        <div className="max-h-[560px] overflow-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-xs uppercase text-slate-700 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold">Date</th>
                                        <th className="px-4 py-3 text-left font-semibold">Opening Balance</th>
                                        <th className="px-4 py-3 text-left font-semibold">From</th>
                                        <th className="px-4 py-3 text-left font-semibold">Via</th>
                                        <th className="px-4 py-3 text-left font-semibold">To</th>
                                        <th className="px-4 py-3 text-right font-semibold">Amount</th>
                                        <th className="px-4 py-3 text-left font-semibold">Closing Balance</th>
                                        <th className="px-4 py-3 text-left font-semibold">Head Account</th>
                                        <th className="px-4 py-3 text-left font-semibold">Category</th>
                                        <th className="px-4 py-3 text-left font-semibold">Sub-category</th>
                                        <th className="px-4 py-3 text-left font-semibold">Remarks</th>
                                        <th className="px-4 py-3 text-left font-semibold">Attachments</th>
                                        <th className="px-4 py-3 text-left font-semibold">Comments</th>
                                        <th className="px-4 py-3 text-right font-semibold">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {drafts.length === 0 ? (
                                        <tr>
                                            <td colSpan={14} className="px-4 py-8 text-center text-sm text-muted-foreground">
                                                {pageLoading ? "Loading transactions..." : "No transactions yet. Run a sync to populate this list."}
                                            </td>
                                        </tr>
                                    ) : (
                                        drafts.map((draft) => (
                                            <tr key={draft.id} className="border-t border-slate-100">
                                                <td className="px-4 py-3">{formatDate(draft.date)}</td>
                                                <td className="px-4 py-3">
                                                    {draft.openingBalance !== null && draft.openingBalance !== undefined
                                                        ? formatCurrency(draft.openingBalance, draft.currency || "USD")
                                                        : "—"}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {draft.fromEntity || renderSourceLabel(draft)}
                                                </td>
                                                <td className="px-4 py-3">{draft.viaEntity || "—"}</td>
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-slate-900">{draft.toEntity || draft.merchantTo || draft.descriptionVia || "—"}</div>
                                                    <div className="text-xs text-muted-foreground">{draft.descriptionVia || draft.merchantTo || "No description"}</div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-semibold">
                                                    {formatCurrency(draft.amount, draft.currency || "USD")}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {draft.closingBalance !== null && draft.closingBalance !== undefined
                                                        ? formatCurrency(draft.closingBalance, draft.currency || "USD")
                                                        : "—"}
                                                </td>
                                                <td className="px-4 py-3">{draft.headAccount || "—"}</td>
                                                <td className="px-4 py-3">{draft.category || "—"}</td>
                                                <td className="px-4 py-3">{draft.subCategory || "—"}</td>
                                                <td className="px-4 py-3">{draft.remarks || "—"}</td>
                                                <td className="px-4 py-3">
                                                    {draft.attachments && draft.attachments.length
                                                        ? `${draft.attachments.length} file${draft.attachments.length === 1 ? "" : "s"}`
                                                        : "—"}
                                                </td>
                                                <td className="px-4 py-3">{draft.comments || "—"}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button variant="ghost" size="icon" onClick={() => openDialog("view", draft)}>
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => openDialog("edit", draft)}>
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            disabled={!isCashTransaction(draft) || rowLoadingId === draft.id}
                                                            onClick={() => handleRowDelete(draft.id)}
                                                            title={isCashTransaction(draft) ? "Delete cash transaction" : "Only cash transactions can be deleted"}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
                <DialogContent className="sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Sync transactions</DialogTitle>
                        <DialogDescription className="text-xs">
                            Choose sources + dates, then sync the latest data.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[1fr_1.6fr_1fr_1fr]">
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
                                        <Button type="button" size="sm" variant="outline" onClick={() => setSelectedSources([])}>
                                            Clear selection
                                        </Button>
                                        <Button type="button" size="sm" onClick={() => setSourcePickerOpen(false)}>
                                            Done
                                        </Button>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="dialogFromDate">From date</Label>
                            <Input id="dialogFromDate" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="dialogToDate">To date</Label>
                            <Input id="dialogToDate" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            onClick={async () => {
                                await handleSync();
                                setSyncDialogOpen(false);
                            }}
                            disabled={syncLoading}
                        >
                            {syncLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Sync transactions
                        </Button>
                        <Button variant="outline" size="sm" onClick={resetSyncConfig}>
                            Reset
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
                <DialogContent className="sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Filters</DialogTitle>
                        <DialogDescription className="text-xs">
                            Filter by account, date, category, or keyword.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[1fr_1.25fr_1.25fr_1fr]">
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
                            <Label>Date range</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <Input type="date" value={filterFromDate} onChange={(e) => setFilterFromDate(e.target.value)} />
                                <Input type="date" value={filterToDate} onChange={(e) => setFilterToDate(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Search keyword</Label>
                            <Input
                                placeholder="Merchant or description..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
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
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            onClick={() => {
                                applyFilters();
                                setFilterDialogOpen(false);
                            }}
                        >
                            Filter
                        </Button>
                        <Button variant="outline" onClick={resetFilters}>
                            Reset
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

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
                                    <p className="text-xs uppercase text-muted-foreground">From</p>
                                    <p className="font-semibold">{dialog.draft.fromEntity || renderSourceLabel(dialog.draft)}</p>
                                    <p className="text-xs text-muted-foreground capitalize">{dialog.draft.account?.type || "account"}</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase text-muted-foreground">Via</p>
                                    <p>{dialog.draft.viaEntity || "—"}</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase text-muted-foreground">To</p>
                                    <p className="font-semibold">{dialog.draft.toEntity || dialog.draft.merchantTo || dialog.draft.descriptionVia || "—"}</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase text-muted-foreground">Opening Balance</p>
                                    <p>
                                        {dialog.draft.openingBalance !== null && dialog.draft.openingBalance !== undefined
                                            ? formatCurrency(dialog.draft.openingBalance, dialog.draft.currency)
                                            : "—"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase text-muted-foreground">Amount</p>
                                    <p>{formatCurrency(dialog.draft.amount, dialog.draft.currency)}</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase text-muted-foreground">Closing Balance</p>
                                    <p>
                                        {dialog.draft.closingBalance !== null && dialog.draft.closingBalance !== undefined
                                            ? formatCurrency(dialog.draft.closingBalance, dialog.draft.currency)
                                            : "—"}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase text-muted-foreground">Head Account</p>
                                    <p>{dialog.draft.headAccount || "—"}</p>
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
                                    <p className="text-xs uppercase text-muted-foreground">Date</p>
                                    <p>{formatDate(dialog.draft.date)}</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase text-muted-foreground">Provider transaction id</p>
                                    <p>{dialog.draft.providerTransactionId || dialog.draft.id}</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <p className="text-xs uppercase text-muted-foreground">Remarks</p>
                                <p>{dialog.draft.remarks || "—"}</p>
                            </div>
                            <div className="space-y-2">
                                <p className="text-xs uppercase text-muted-foreground">Comments</p>
                                <p>{dialog.draft.comments || "—"}</p>
                            </div>
                            <div className="space-y-2">
                                <p className="text-xs uppercase text-muted-foreground">Attachments</p>
                                {dialog.draft.attachments && dialog.draft.attachments.length ? (
                                    <ul className="list-disc pl-4">
                                        {dialog.draft.attachments.map((item, idx) => (
                                            <li key={`${item}-${idx}`}>{item}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p>—</p>
                                )}
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
                                    <Label>Head Account</Label>
                                    <Input
                                        value={editForm.headAccount}
                                        onChange={(e) => setEditForm((prev) => ({ ...prev, headAccount: e.target.value }))}
                                        placeholder="Required"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Opening Balance</Label>
                                    <Input
                                        type="number"
                                        value={editForm.openingBalance}
                                        onChange={(e) => setEditForm((prev) => ({ ...prev, openingBalance: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Closing Balance</Label>
                                    <Input
                                        type="number"
                                        value={editForm.closingBalance}
                                        onChange={(e) => setEditForm((prev) => ({ ...prev, closingBalance: e.target.value }))}
                                    />
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
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label>From</Label>
                                    <Input value={editForm.fromEntity} onChange={(e) => setEditForm((prev) => ({ ...prev, fromEntity: e.target.value }))} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Via</Label>
                                    <Input value={editForm.viaEntity} onChange={(e) => setEditForm((prev) => ({ ...prev, viaEntity: e.target.value }))} />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label>To</Label>
                                <Input value={editForm.toEntity} onChange={(e) => setEditForm((prev) => ({ ...prev, toEntity: e.target.value }))} />
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
                                <Label>Remarks</Label>
                                <Textarea rows={3} value={editForm.remarks} onChange={(e) => setEditForm((prev) => ({ ...prev, remarks: e.target.value }))} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Comments</Label>
                                <Textarea rows={3} value={editForm.comments} onChange={(e) => setEditForm((prev) => ({ ...prev, comments: e.target.value }))} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Attachments</Label>
                                <Input
                                    value={editForm.attachments}
                                    onChange={(e) => setEditForm((prev) => ({ ...prev, attachments: e.target.value }))}
                                    placeholder="Comma-separated URLs or filenames"
                                />
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
