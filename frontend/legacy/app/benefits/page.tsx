import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { findBenefitsForProduct, type Benefit } from "@/lib/benefits-reference";
import { MainNav } from "@/components/main-nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = {
    title: "Benefits & Plans - CardSense",
    description: "Inspect stored product metadata and mapped benefits for cards and accounts.",
};

function formatTags(value?: string | null) {
    if (!value) return [];
    return value.split(",").map((v) => v.trim()).filter(Boolean);
}

export default async function BenefitsPage() {
    const [cards, accounts] = await Promise.all([
        prisma.card.findMany({
            orderBy: { name: "asc" },
            select: { id: true, name: true, bank: true, cardCategory: true, productCode: true, planName: true, benefitsJson: true, tags: true },
        }),
        prisma.bankAccount.findMany({
            orderBy: { name: "asc" },
            select: { id: true, name: true, type: true, providerAccountId: true, productCode: true, planName: true, benefitsJson: true, tags: true },
        }),
    ]);

    const parseBenefits = (json?: string | null): Benefit[] => {
        if (!json) return [];
        try {
            const parsed: unknown = JSON.parse(json);
            if (Array.isArray(parsed)) {
                return parsed.filter((item): item is Benefit => typeof item === "object" && item !== null && "title" in (item as Record<string, unknown>));
            }
            if (parsed && typeof parsed === "object" && "benefits" in parsed) {
                const benefits = (parsed as { benefits?: unknown }).benefits;
                if (Array.isArray(benefits)) {
                    return benefits.filter((item): item is Benefit => typeof item === "object" && item !== null && "title" in (item as Record<string, unknown>));
                }
            }
        } catch {
            return [];
        }
        return [];
    };

    return (
        <div className="flex flex-col min-h-screen bg-slate-50">
            <div className="border-b bg-white/80 backdrop-blur-md shadow-sm">
                <div className="flex h-16 items-center px-4">
                    <h1 className="text-xl font-bold mr-8 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">CardSense</h1>
                    <MainNav className="mx-6" />
                </div>
            </div>
            <div className="mx-auto w-full max-w-6xl px-6 py-10 space-y-8 flex-1">
                <div>
                    <p className="text-sm font-semibold text-indigo-500 tracking-wider uppercase">Product metadata</p>
                    <h1 className="mt-3 text-3xl font-bold text-slate-900">Benefits & Plans</h1>
                    <p className="mt-2 text-base text-slate-600">Review captured product codes, plans, and benefits for cards and bank accounts.</p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Cards</CardTitle>
                            <CardDescription>Product codes, plans, tags, and mapped benefits.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="rounded-md border overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Product</TableHead>
                                            <TableHead>Benefits</TableHead>
                                            <TableHead>Tags</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {cards.map((card) => {
                                            const ref = findBenefitsForProduct(card.productCode || undefined, card.planName || undefined);
                                            const stored = parseBenefits(card.benefitsJson);
                                            const tags = formatTags(card.tags);
                                            return (
                                                <TableRow key={card.id}>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">{card.name}</span>
                                                            <span className="text-xs text-muted-foreground">{card.bank || card.cardCategory || "—"}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-sm">
                                                            <div>{card.planName || "—"}</div>
                                                            <div className="text-xs text-muted-foreground">{card.productCode || "—"}</div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        <div className="space-y-1">
                                                            {stored.slice(0, 4).map((b, idx) => (
                                                                <div key={idx} className="text-xs">{b.title || JSON.stringify(b)}</div>
                                                            ))}
                                                            {ref?.benefits && ref.benefits.length > 0 && (
                                                                <div className="text-xs text-indigo-600">Reference: {ref.benefits.length} mapped</div>
                                                            )}
                                                            {stored.length === 0 && !ref?.benefits?.length && (
                                                                <div className="text-xs text-muted-foreground">None</div>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-wrap gap-1">
                                                            {tags.map((t) => (
                                                                <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{t}</span>
                                                            ))}
                                                            {tags.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Bank Accounts</CardTitle>
                            <CardDescription>Product codes, plans, tags, and mapped benefits.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="rounded-md border overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Product</TableHead>
                                            <TableHead>Benefits</TableHead>
                                            <TableHead>Tags</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {accounts.map((acct) => {
                                            const ref = findBenefitsForProduct(acct.productCode || undefined, acct.planName || undefined);
                                            const stored = parseBenefits(acct.benefitsJson);
                                            const tags = formatTags(acct.tags);
                                            return (
                                                <TableRow key={acct.id}>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">{acct.name || "Account"}</span>
                                                            <span className="text-xs text-muted-foreground">{acct.type || acct.providerAccountId}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-sm">
                                                            <div>{acct.planName || "—"}</div>
                                                            <div className="text-xs text-muted-foreground">{acct.productCode || "—"}</div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        <div className="space-y-1">
                                                            {stored.slice(0, 4).map((b, idx) => (
                                                                <div key={idx} className="text-xs">{b.title || JSON.stringify(b)}</div>
                                                            ))}
                                                            {ref?.benefits && ref.benefits.length > 0 && (
                                                                <div className="text-xs text-indigo-600">Reference: {ref.benefits.length} mapped</div>
                                                            )}
                                                            {stored.length === 0 && !ref?.benefits?.length && (
                                                                <div className="text-xs text-muted-foreground">None</div>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-wrap gap-1">
                                                            {tags.map((t) => (
                                                                <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{t}</span>
                                                            ))}
                                                            {tags.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
