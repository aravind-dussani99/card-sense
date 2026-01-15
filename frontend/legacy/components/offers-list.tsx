"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Gift, Calendar, DollarSign, Archive, CheckCircle2, Mail, ChevronDown, ChevronUp } from "lucide-react";
import {
    getAllOffers,
    archiveExpiredOffers,
    updateOfferStatus,
    markOfferAsRead,
} from "@/app/actions/offer-actions";
import { useRouter } from "next/navigation";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface OffersListProps {
    initialOffers: any[];
    cards: any[];
}

export function OffersList({ initialOffers, cards }: OffersListProps) {
    const router = useRouter();
    const [offers, setOffers] = useState(initialOffers);
    const [allOffers, setAllOffers] = useState<any[]>([]);
    const [timeFilter, setTimeFilter] = useState<"all" | "present" | "future" | "past" | "expired">("present");
    const [readFilter, setReadFilter] = useState<"all" | "unread" | "read" | "archived">("all");
    const [senderFilter, setSenderFilter] = useState<string>("all");
    const [selectedOfferId, setSelectedOfferId] = useState<string>("all");
    const [expandedOffers, setExpandedOffers] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadAllOffers();
        // Note: archiveExpiredOffers is called server-side when processing emails
        // Don't call it here to avoid unnecessary POST requests
    }, []);
    
    // Refresh offers when initialOffers changes (e.g., after email processing)
    useEffect(() => {
        setOffers(initialOffers);
        setAllOffers(initialOffers);
    }, [initialOffers]);

    const loadAllOffers = async () => {
        const all = await getAllOffers();
        setAllOffers(all);
        setOffers(all);
    };

    const handleArchive = async (id: string) => {
        setLoading(true);
        const result = await updateOfferStatus(id, "archived");
        setLoading(false);
        if (result.success) {
            await loadAllOffers();
            router.refresh();
        }
    };

    const handleMarkUsed = async (id: string) => {
        setLoading(true);
        const result = await updateOfferStatus(id, "used");
        setLoading(false);
        if (result.success) {
            await loadAllOffers();
            router.refresh();
        }
    };

    const handleMarkAsRead = async (id: string) => {
        setLoading(true);
        const result = await markOfferAsRead(id);
        setLoading(false);
        if (result.success) {
            await loadAllOffers();
            router.refresh();
        }
    };

    const toggleExpand = (id: string) => {
        const newExpanded = new Set(expandedOffers);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedOffers(newExpanded);
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

    const getDaysRemaining = (endDate: Date | string) => {
        const end = new Date(endDate);
        const now = new Date();
        const diff = end.getTime() - now.getTime();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        return days;
    };

    // Get unique sender emails for filter
    const senderEmails = Array.from(new Set(allOffers.filter(o => o.senderEmail).map(o => o.senderEmail))).sort();

    const now = new Date();
    const getTiming = (offer: any) => {
        const start = offer.startDate ? new Date(offer.startDate) : null;
        const end = offer.endDate ? new Date(offer.endDate) : null;
        if (offer.status === "archived" || offer.status === "used") return "past";
        if (start && start > now) return "future";
        if (end && end < now) return "expired";
        return "present";
    };

    let filteredOffers = allOffers;

    if (timeFilter !== "all") {
        filteredOffers = filteredOffers.filter((o) => getTiming(o) === timeFilter);
    }

    if (readFilter === "unread") {
        filteredOffers = filteredOffers.filter((o) => !o.isRead);
    } else if (readFilter === "read") {
        filteredOffers = filteredOffers.filter((o) => o.isRead);
    } else if (readFilter === "archived") {
        filteredOffers = filteredOffers.filter((o) => o.status === "archived" || o.status === "used");
    }

    if (senderFilter !== "all") {
        filteredOffers = filteredOffers.filter((o) => o.senderEmail === senderFilter);
    }

    if (selectedOfferId !== "all") {
        filteredOffers = filteredOffers.filter((o) => o.id === selectedOfferId);
    }

    const renderOfferCard = (offer: any) => {
        const daysRemaining = getDaysRemaining(offer.endDate);
        const isExpiringSoon = daysRemaining <= 7 && daysRemaining >= 0;
        const isExpanded = expandedOffers.has(offer.id);

        return (
            <Card key={offer.id} className="relative">
                <CardHeader>
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <CardTitle className="text-lg flex items-center gap-2">
                                {offer.title}
                                {!offer.isRead && offer.status === "active" && (
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs">
                                        New
                                    </Badge>
                                )}
                            </CardTitle>
                            {offer.card && (
                                <CardDescription>
                                    {offer.card.name} (••{offer.card.last4})
                                </CardDescription>
                            )}
                            {offer.senderEmail && (
                                <CardDescription className="text-xs mt-1">
                                    From: {offer.senderEmail}
                                </CardDescription>
                            )}
                        </div>
                        {isExpiringSoon && (
                            <Badge variant="destructive" className="text-xs">
                                {daysRemaining}d left
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{offer.description}</p>

                    {/* Discount Info */}
                    <div className="flex items-center gap-4">
                        {offer.discountAmount && (
                            <div className="flex items-center gap-1">
                                <DollarSign className="h-4 w-4 text-green-600" />
                                <span className="font-semibold text-green-600">
                                    Save {formatCurrency(offer.discountAmount)}
                                </span>
                            </div>
                        )}
                        {offer.discountPercent && (
                            <div className="flex items-center gap-1">
                                <span className="font-semibold text-green-600">
                                    {offer.discountPercent}% off
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Terms */}
                    {offer.minSpend && (
                        <div className="text-xs text-muted-foreground">
                            Min. spend: {formatCurrency(offer.minSpend)}
                        </div>
                    )}
                    {offer.maxDiscount && (
                        <div className="text-xs text-muted-foreground">
                            Max. discount: {formatCurrency(offer.maxDiscount)}
                        </div>
                    )}

                    {/* Validity */}
                    <div className="space-y-1 pt-2 border-t">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>Valid: {formatDate(offer.startDate)} - {formatDate(offer.endDate)}</span>
                        </div>
                        {daysRemaining >= 0 && (
                            <div className={`text-xs font-medium ${
                                isExpiringSoon ? "text-red-600" : "text-green-600"
                            }`}>
                                {daysRemaining === 0
                                    ? "Expires today"
                                    : `${daysRemaining} days remaining`}
                            </div>
                        )}
                    </div>

                    {/* Email Content Expand/Collapse */}
                    {(offer.emailSubject || offer.emailBody) && (
                        <div className="border-t pt-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleExpand(offer.id)}
                                className="w-full justify-between"
                            >
                                <span className="flex items-center gap-2">
                                    <Mail className="h-4 w-4" />
                                    {isExpanded ? "Hide" : "Show"} Email Content
                                </span>
                                {isExpanded ? (
                                    <ChevronUp className="h-4 w-4" />
                                ) : (
                                    <ChevronDown className="h-4 w-4" />
                                )}
                            </Button>
                            {isExpanded && (
                                <div className="mt-2 p-3 bg-gray-50 rounded-md text-xs space-y-2 max-h-96 overflow-y-auto">
                                    {offer.emailSubject && (
                                        <div>
                                            <strong>Subject:</strong> {offer.emailSubject}
                                        </div>
                                    )}
                                    {offer.emailBody && (
                                        <div>
                                            <strong>Body:</strong>
                                            <div 
                                                className="mt-1 whitespace-pre-wrap"
                                                dangerouslySetInnerHTML={{ __html: offer.emailBody.substring(0, 5000) }}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Terms & Conditions */}
                    {offer.terms && (
                        <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                Terms & Conditions
                            </summary>
                            <p className="mt-2 text-muted-foreground">{offer.terms}</p>
                        </details>
                    )}

                    {/* Actions */}
                    {offer.status === "active" && (
                        <div className="flex gap-2 pt-2">
                            {!offer.isRead && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleMarkAsRead(offer.id)}
                                    disabled={loading}
                                    className="flex-1"
                                >
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    Mark as Read
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleMarkUsed(offer.id)}
                                disabled={loading}
                            >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Mark Used
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleArchive(offer.id)}
                                disabled={loading}
                            >
                                <Archive className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="flex items-center gap-4 flex-wrap">
                <Select value={selectedOfferId} onValueChange={setSelectedOfferId}>
                    <SelectTrigger className="w-64">
                        <SelectValue placeholder="All offers" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All offers</SelectItem>
                        {allOffers
                            .slice()
                            .sort((a, b) => (a.title || "").localeCompare(b.title || ""))
                            .map((offer) => (
                                <SelectItem key={offer.id} value={offer.id}>
                                    {offer.title || "Untitled offer"}
                                </SelectItem>
                            ))}
                    </SelectContent>
                </Select>

                <Select value={timeFilter} onValueChange={(value: any) => setTimeFilter(value)}>
                    <SelectTrigger className="w-48">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="present">Present Offers</SelectItem>
                        <SelectItem value="future">Future Offers</SelectItem>
                        <SelectItem value="past">Past Offers</SelectItem>
                        <SelectItem value="expired">Expired Offers</SelectItem>
                        <SelectItem value="all">All Offers</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={readFilter} onValueChange={(value: any) => setReadFilter(value)}>
                    <SelectTrigger className="w-48">
                        <SelectValue placeholder="Read status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="unread">Unread</SelectItem>
                        <SelectItem value="read">Read</SelectItem>
                        <SelectItem value="archived">Archived / Used</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={senderFilter} onValueChange={setSenderFilter}>
                    <SelectTrigger className="w-64">
                        <SelectValue placeholder="Filter by sender" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Senders</SelectItem>
                        {senderEmails.map(email => (
                            <SelectItem key={email} value={email}>{email}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Badge variant="outline" className="bg-green-50 text-green-700">
                    {filteredOffers.length} offer{filteredOffers.length === 1 ? "" : "s"}
                </Badge>
            </div>

            {/* Empty State */}
            {filteredOffers.length === 0 && (
                <Card>
                    <CardContent className="p-8 text-center">
                        <Gift className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No Offers Found</h3>
                        <p className="text-muted-foreground">
                            Adjust filters or retrieve offers to see more.
                        </p>
                    </CardContent>
                </Card>
            )}

            {filteredOffers.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredOffers.map(renderOfferCard)}
                </div>
            )}
        </div>
    );
}
