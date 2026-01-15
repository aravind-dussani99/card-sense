"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Download, AlertCircle, CheckCircle2, Loader2, Info, Mail, X } from "lucide-react";
import { processEmailsWithDateRange } from "@/app/actions/email-processor-actions";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ProcessedEmailsDialog } from "@/components/processed-emails-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface EmailRetrieverProps {
    type: "transactions" | "offers" | "both";
    processingHistory: {
        dateRanges: Array<{ start: string; end: string; count: number }>;
        lastProcessedDate: string | null;
        gaps: Array<{ start: string; end: string }>;
        totalProcessed: number;
    };
}

export function EmailRetriever({ type, processingHistory }: EmailRetrieverProps) {
    const router = useRouter();
    // Default to last 7 days
    const getDefaultDates = () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 7);
        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0],
        };
    };
    const defaultDates = getDefaultDates();
    const [startDate, setStartDate] = useState<string>(defaultDates.start);
    const [endDate, setEndDate] = useState<string>(defaultDates.end);
    const [provider, setProvider] = useState<"gmail" | "outlook" | "all">("all");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{
        success: boolean;
        processed?: number;
        totalAvailable?: number;
        transactions?: number;
        offers?: number;
        hasMore?: boolean;
        nextSkip?: number;
        error?: string;
    } | null>(null);
    const [skipCount, setSkipCount] = useState(0);
    const [processingBatch, setProcessingBatch] = useState(1);
    const [customDateMode, setCustomDateMode] = useState(false);
    const [infoPopoverOpen, setInfoPopoverOpen] = useState(false);

    const formatDate = (date: Date | string) => {
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const handleQuickSelect = (days: number) => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - days);
        setEndDate(end.toISOString().split('T')[0]);
        setStartDate(start.toISOString().split('T')[0]);
    };

    const handleProcess = async (skip: number = 0) => {
        // Use default dates (last 7 days) if not set
        const finalStartDate = startDate || defaultDates.start;
        const finalEndDate = endDate || defaultDates.end;
        
        // Update state if we're using defaults
        if (!startDate) setStartDate(finalStartDate);
        if (!endDate) setEndDate(finalEndDate);

        setLoading(true);
        setResult(null);

        try {
            const start = new Date(finalStartDate);
            const end = new Date(finalEndDate);
            end.setHours(23, 59, 59, 999); // Include full end date

            const processType = type === "both" ? "both" : (type === "transactions" ? "transactions" : "offers");
            const result = await processEmailsWithDateRange(
                start,
                end,
                processType,
                50, // Max 50 emails per batch
                skip,
                provider
            );

            setResult(result);
            setSkipCount(skip);
            
            if (result.success) {
                router.refresh();
            }
        } catch (error: any) {
            setResult({
                success: false,
                error: error.message || "Failed to process emails",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleNextBatch = () => {
        if (result?.nextSkip !== undefined) {
            setProcessingBatch(processingBatch + 1);
            handleProcess(result.nextSkip);
        }
    };

    const lastProcessed = processingHistory.lastProcessedDate ? new Date(processingHistory.lastProcessedDate) : null;
    const hasGaps = processingHistory.gaps.length > 0;

    // Check which providers are configured (client-side check)
    // Note: In production, this should be passed as props from server component
    const [gmailConfigured, setGmailConfigured] = useState(true); // Default to true, will be updated
    const [outlookConfigured, setOutlookConfigured] = useState(true); // Default to true, will be updated
    
    // In a real implementation, these would be passed as props from the server
    // For now, we'll show both options and let the backend handle the check

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    {type === "both" ? "Retrieve Transactions & Offers" : (type === "transactions" ? "Retrieve Transactions" : "Retrieve Offers")}
                </CardTitle>
                <CardDescription>
                    Process emails from Gmail and Outlook for the selected date range. 
                    Maximum 50 emails per retrieval to reduce load.
                    {type === "both" && " Both transactions and offers will be extracted."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column: Processing History */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Info className="h-5 w-5" />
                            Processing History
                        </h3>
                        
                        {processingHistory.totalProcessed > 0 ? (
                            <div className="space-y-4">
                                {lastProcessed && (
                                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                        <p className="text-sm font-medium text-blue-900 mb-1">Last Processed</p>
                                        <p className="text-sm text-blue-700">
                                            {formatDate(lastProcessed)}
                                        </p>
                                    </div>
                                )}
                                
                                {processingHistory.dateRanges.length > 0 && (
                                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                                        <p className="text-sm font-medium text-green-900 mb-2">Processed Date Ranges</p>
                                        <div className="text-xs text-green-700 space-y-2 max-h-64 overflow-y-auto">
                                            {processingHistory.dateRanges.map((range, idx) => (
                                                <div key={idx} className="border-b border-green-200 pb-2 last:border-0 last:pb-0">
                                                    <p className="font-medium">
                                                        {formatDate(range.start)} to {formatDate(range.end)}
                                                    </p>
                                                    <p className="text-xs text-green-600">{range.count} emails processed</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                {/* Processed Dates List */}
                                {processingHistory.dateRanges.length > 0 && (
                                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                                        <p className="text-sm font-medium text-purple-900 mb-2">All Processed Dates</p>
                                        <div className="text-xs text-purple-700 space-y-1 max-h-48 overflow-y-auto">
                                            <ul className="list-disc list-inside space-y-1">
                                                {processingHistory.dateRanges.flatMap((range, idx) => {
                                                    const dates: string[] = [];
                                                    const start = new Date(range.start);
                                                    const end = new Date(range.end);
                                                    const current = new Date(start);
                                                    while (current <= end) {
                                                        dates.push(formatDate(new Date(current)));
                                                        current.setDate(current.getDate() + 1);
                                                    }
                                                    return dates.map((date, dateIdx) => (
                                                        <li key={`${idx}-${dateIdx}`}>{date}</li>
                                                    ));
                                                })}
                                            </ul>
                                        </div>
                                    </div>
                                )}
                                
                                {hasGaps && (
                                    <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                                        <p className="text-sm font-medium text-orange-900 mb-2">Missing Date Ranges</p>
                                        <div className="text-xs text-orange-700 space-y-1 max-h-48 overflow-y-auto">
                                            <ul className="list-disc list-inside space-y-1">
                                                {processingHistory.gaps.map((gap, idx) => (
                                                    <li key={idx}>
                                                        {formatDate(gap.start)} to {formatDate(gap.end)}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                )}
                                
                                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                    <p className="text-sm font-medium text-gray-900 mb-1">Total Processed</p>
                                    <p className="text-2xl font-bold text-gray-700">{processingHistory.totalProcessed}</p>
                                    <p className="text-xs text-gray-600 mt-1">emails processed</p>
                                    <div className="mt-3">
                                        <ProcessedEmailsDialog />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-8 text-center border border-dashed rounded-lg">
                                <Info className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                <p className="text-sm text-muted-foreground">
                                    No processing history yet. Start retrieving emails to see your history here.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Controls and Filters */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Calendar className="h-5 w-5" />
                            Date Range & Filters
                        </h3>

                        {/* Email Provider Selection */}
                        <div className="space-y-2">
                            <Label htmlFor="provider">Email Provider</Label>
                            <Select value={provider} onValueChange={(value: "gmail" | "outlook" | "all") => setProvider(value)}>
                                <SelectTrigger id="provider">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Providers</SelectItem>
                                    {gmailConfigured && <SelectItem value="gmail">Gmail Only</SelectItem>}
                                    {outlookConfigured && <SelectItem value="outlook">Outlook Only</SelectItem>}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Select which email account(s) to retrieve from
                            </p>
                        </div>

                        {/* Quick Select Buttons */}
                        <div className="space-y-2">
                            <Label>Quick Select</Label>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant={!customDateMode ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => {
                                        handleQuickSelect(7);
                                        setCustomDateMode(false);
                                    }}
                                    disabled={loading}
                                >
                                    Last 7 Days
                                </Button>
                                <Button
                                    variant={!customDateMode ? "outline" : "outline"}
                                    size="sm"
                                    onClick={() => {
                                        handleQuickSelect(30);
                                        setCustomDateMode(false);
                                    }}
                                    disabled={loading}
                                >
                                    Last 30 Days
                                </Button>
                                {lastProcessed && (
                                    <Button
                                        variant={!customDateMode ? "outline" : "outline"}
                                        size="sm"
                                        onClick={() => {
                                            const start = new Date(lastProcessed);
                                            start.setDate(start.getDate() + 1);
                                            const end = new Date();
                                            setStartDate(start.toISOString().split('T')[0]);
                                            setEndDate(end.toISOString().split('T')[0]);
                                            setCustomDateMode(false);
                                        }}
                                        disabled={loading}
                                    >
                                        Since Last Processed
                                    </Button>
                                )}
                                <Button
                                    variant={customDateMode ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setCustomDateMode(true)}
                                    disabled={loading}
                                >
                                    Custom Date Range
                                </Button>
                            </div>
                        </div>

                        {/* Date Range Inputs */}
                        {(customDateMode || startDate !== defaultDates.start || endDate !== defaultDates.end) && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="startDate">From Date</Label>
                                    <Input
                                        id="startDate"
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => {
                                            setStartDate(e.target.value);
                                            setCustomDateMode(true);
                                        }}
                                        disabled={loading}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="endDate">To Date</Label>
                                    <Input
                                        id="endDate"
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => {
                                            setEndDate(e.target.value);
                                            setCustomDateMode(true);
                                        }}
                                        disabled={loading}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Process Button with Info Popover */}
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={() => {
                                    setProcessingBatch(1);
                                    handleProcess(0);
                                }}
                                disabled={loading || !startDate || !endDate}
                                className="flex-1"
                                size="lg"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                    <Download className="h-4 w-4 mr-2" />
                                    {type === "both" ? "Retrieve Transactions & Offers" : (type === "transactions" ? "Retrieve Transactions" : "Retrieve Offers")}
                                    </>
                                )}
                            </Button>
                            <Popover open={infoPopoverOpen} onOpenChange={setInfoPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="icon" className="h-10 w-10">
                                        <Info className="h-4 w-4" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80" align="end">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-semibold text-sm">Processing Information</h4>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-6 w-6"
                                                onClick={() => setInfoPopoverOpen(false)}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <div className="text-xs text-muted-foreground space-y-2">
                                            <ul className="list-disc list-inside space-y-1">
                                                <li>Processing is limited to 50 emails per retrieval to reduce application load</li>
                                                <li>If more emails are available, use "Process Next Batch" to continue</li>
                                                <li>Already processed emails will be skipped automatically</li>
                                                <li>Select a specific provider to avoid authentication conflicts</li>
                                            </ul>
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Result Display */}
                        {result && (
                            <Alert variant={result.success ? "default" : "destructive"}>
                                {result.success ? (
                                    <CheckCircle2 className="h-4 w-4" />
                                ) : (
                                    <AlertCircle className="h-4 w-4" />
                                )}
                                <AlertTitle>
                                    {result.success ? "Processing Complete" : "Processing Failed"}
                                </AlertTitle>
                                <AlertDescription>
                                    {result.success ? (
                                        <div className="space-y-2">
                                            <p>
                                                Processed {result.processed} emails
                                                {result.totalAvailable !== undefined && (
                                                    <> (Total available: {result.totalAvailable})</>
                                                )}
                                            </p>
                                            {type === "both" && (
                                                <>
                                                    {result.transactions !== undefined && (
                                                        <p className="font-medium">Extracted {result.transactions} transactions</p>
                                                    )}
                                                    {result.offers !== undefined && (
                                                        <p className="font-medium">Extracted {result.offers} offers</p>
                                                    )}
                                                </>
                                            )}
                                            {type === "transactions" && result.transactions !== undefined && (
                                                <p className="font-medium">Extracted {result.transactions} transactions</p>
                                            )}
                                            {type === "offers" && result.offers !== undefined && (
                                                <p className="font-medium">Extracted {result.offers} offers</p>
                                            )}
                                            {result.hasMore && (
                                                <div className="mt-3 pt-3 border-t">
                                                    <p className="text-sm font-medium mb-2">
                                                        More emails available! Processed batch {processingBatch} of approximately {Math.ceil((result.totalAvailable || 0) / 50)} batches.
                                                    </p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={handleNextBatch}
                                                        disabled={loading}
                                                        className="w-full"
                                                    >
                                                        Process Next Batch ({result.totalAvailable! - (result.nextSkip || 0)} remaining)
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <p>{result.error || "An error occurred while processing emails"}</p>
                                    )}
                                </AlertDescription>
                            </Alert>
                        )}


                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
