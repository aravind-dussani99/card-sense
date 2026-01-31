import { Metadata } from "next";
import { MainNav } from "@/components/main-nav";
import { AuthMenu } from "@/components/auth-menu";
import { VaultClient } from "@/components/vault-client";

export const metadata: Metadata = {
    title: "Secure Vault - CardSense",
    description: "Local-only encrypted vault for sensitive data.",
};

export default async function VaultPage() {
    return (
        <div className="flex flex-col min-h-screen bg-slate-50">
            <div className="border-b bg-white/80 backdrop-blur-md shadow-sm">
                <div className="flex h-16 items-center px-4">
                    <h1 className="text-xl font-bold mr-8 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                        CardSense
                    </h1>
                    <MainNav className="mx-6" />
                    <div className="ml-auto flex items-center gap-3">
                        <AuthMenu />
                    </div>
                </div>
            </div>
            <div className="mx-auto w-full max-w-5xl px-6 py-10 flex-1">
                <VaultClient />
            </div>
        </div>
    );
}
