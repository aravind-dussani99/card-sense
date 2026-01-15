import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { MainNav } from "@/components/main-nav";

export const metadata: Metadata = {
    title: "Bank Raw Data - CardSense",
    description: "Inspect raw open banking transactions.",
};

function formatDate(value: Date) {
    return value.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

export default async function BankRawPage() {
    const rows = await prisma.bankTransaction.findMany({
        orderBy: { date: "desc" },
        take: 200,
        select: {
            id: true,
            date: true,
            amount: true,
            currency: true,
            descriptionVia: true,
            raw: true,
        },
    });

    return (
        <div className="flex flex-col min-h-screen">
            <div className="border-b bg-white/80 backdrop-blur-md shadow-sm">
                <div className="flex h-16 items-center px-4">
                    <h1 className="text-xl font-bold mr-8 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                        CardSense
                    </h1>
                    <MainNav className="mx-6" />
                </div>
            </div>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex items-center justify-between space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight">Bank Raw Data</h2>
                </div>
                <div className="rounded-lg border bg-white overflow-hidden">
                    <div className="max-h-[70vh] overflow-auto">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-white z-10 border-b">
                                <tr>
                                    <th className="text-left p-3 w-14">S. No.</th>
                                    <th className="text-left p-3">Date</th>
                                    <th className="text-left p-3">Amount</th>
                                    <th className="text-left p-3">Description</th>
                                    <th className="text-left p-3">Raw Data</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-6 text-center text-muted-foreground">
                                            No transactions yet.
                                        </td>
                                    </tr>
                                )}
                                {rows.map((row, idx) => {
                                    let formattedRaw = row.raw || "";
                                    try {
                                        formattedRaw = row.raw ? JSON.stringify(JSON.parse(row.raw), null, 2) : "";
                                    } catch {
                                        formattedRaw = row.raw || "";
                                    }
                                    return (
                                        <tr key={row.id} className="border-b align-top">
                                            <td className="p-3">{idx + 1}</td>
                                            <td className="p-3 whitespace-nowrap">{formatDate(row.date)}</td>
                                            <td className="p-3 whitespace-nowrap">
                                                {(row.amount < 0 ? "-" : "") + (row.currency || "£") + Math.abs(row.amount).toFixed(2)}
                                            </td>
                                            <td className="p-3">{row.descriptionVia || "—"}</td>
                                            <td className="p-3">
                                                <details>
                                                    <summary className="cursor-pointer text-xs text-muted-foreground">
                                                        View raw JSON
                                                    </summary>
                                                    <pre className="mt-2 max-h-64 overflow-auto rounded bg-slate-100 p-2 text-xs text-slate-800">
                                                        {formattedRaw || "—"}
                                                    </pre>
                                                </details>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
