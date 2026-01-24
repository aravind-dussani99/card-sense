import { Metadata } from "next"
import { MainNav } from "@/components/main-nav"
import { SettingsContent } from "@/components/settings-content"
import { getBankConnections } from "@/app/actions/bank-actions"

export const metadata: Metadata = {
    title: "Settings - CardSense",
    description: "Manage your account settings.",
}

export default async function SettingsPage() {
    const connections = await getBankConnections();
    const now = Date.now();
    const connectionsWithExpiry = connections.map((connection) => {
        const createdAt = connection.createdAt ? new Date(connection.createdAt).getTime() : now;
        const days = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
        const daysLeft = Math.max(0, 90 - days);
        return { ...connection, daysLeft };
    });

    return (
        <div className="flex flex-col min-h-screen">
            <div className="border-b bg-white/80 backdrop-blur-md shadow-sm">
                <div className="flex h-16 items-center px-4">
                    <h1 className="text-xl font-bold mr-8 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">CardSense</h1>
                    <MainNav className="mx-6" />
                </div>
            </div>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <div className="flex items-center justify-between space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
                </div>
                <SettingsContent connections={connectionsWithExpiry} />
            </div>
        </div>
    )
}
