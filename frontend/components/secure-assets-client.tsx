"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { encryptPayload } from "@/lib/vault";
import { SecureRecordType, SecureVaultRecord, UserAccount, UserCard } from "@/lib/types";

const RECORD_TYPES: SecureRecordType[] = ["BANK_ACCOUNT", "OVERDRAFT", "CREDIT_CARD", "DEBIT_CARD", "OTHER"];

export function SecureAssetsClient() {
    const [vaultRecords, setVaultRecords] = useState<SecureVaultRecord[]>([]);
    const [userAccounts, setUserAccounts] = useState<UserAccount[]>([]);
    const [userCards, setUserCards] = useState<UserCard[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const [vaultDraft, setVaultDraft] = useState({
        recordType: "BANK_ACCOUNT" as SecureRecordType,
        label: "",
        bankName: "",
        accountNumber: "",
        sortCode: "",
        cardLast4: "",
        username: "",
        status: "active",
        passphrase: "",
        payloadJson: "{\n  \"note\": \"example\"\n}",
    });

    const [accountDraft, setAccountDraft] = useState({
        label: "",
        bankName: "",
        accountType: "bank",
        accountNumber: "",
        sortCode: "",
        currency: "",
        balance: "",
        limit: "",
        status: "active",
        linkedBankAccountId: "",
        secureRecordId: "",
    });

    const [cardDraft, setCardDraft] = useState({
        label: "",
        cardType: "credit",
        issuerBankName: "",
        network: "",
        last4: "",
        statementDay: "",
        dueDay: "",
        status: "active",
        linkedBankAccountId: "",
        secureRecordId: "",
    });

    const loadData = async () => {
        setLoading(true);
        setError(null);
        setStatus(null);
        try {
            const [vault, accounts, cards] = await Promise.all([
                apiFetch<SecureVaultRecord[]>("/api/secure-vault"),
                apiFetch<UserAccount[]>("/api/user-accounts"),
                apiFetch<UserCard[]>("/api/user-cards"),
            ]);
            setVaultRecords(vault || []);
            setUserAccounts(accounts || []);
            setUserCards(cards || []);
        } catch (err) {
            setError(getErrorMessage(err, "Failed to load secure assets"));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, []);

    const secureRecordOptions = useMemo(
        () => vaultRecords.map((record) => ({ value: record.id, label: record.label })),
        [vaultRecords]
    );

    const handleAddVault = async () => {
        setError(null);
        setStatus(null);
        if (!vaultDraft.label.trim()) {
            setError("Vault record label is required.");
            return;
        }
        if (!vaultDraft.passphrase) {
            setError("Passphrase is required to encrypt payload.");
            return;
        }
        let parsedPayload: unknown = {};
        try {
            parsedPayload = JSON.parse(vaultDraft.payloadJson || "{}");
        } catch {
            setError("Payload JSON is invalid.");
            return;
        }
        try {
            const encryptedPayload = await encryptPayload(vaultDraft.passphrase, parsedPayload);
            const created = await apiFetch<SecureVaultRecord>("/api/secure-vault", {
                method: "POST",
                body: JSON.stringify({
                    recordType: vaultDraft.recordType,
                    label: vaultDraft.label.trim(),
                    bankName: vaultDraft.bankName || undefined,
                    accountNumber: vaultDraft.accountNumber || undefined,
                    sortCode: vaultDraft.sortCode || undefined,
                    cardLast4: vaultDraft.cardLast4 || undefined,
                    username: vaultDraft.username || undefined,
                    status: vaultDraft.status || "active",
                    encryptedPayload,
                }),
            });
            setVaultRecords((prev) => [created, ...prev]);
            setVaultDraft({
                recordType: "BANK_ACCOUNT",
                label: "",
                bankName: "",
                accountNumber: "",
                sortCode: "",
                cardLast4: "",
                username: "",
                status: "active",
                passphrase: "",
                payloadJson: "{\n  \"note\": \"example\"\n}",
            });
            setStatus("Secure vault record added.");
        } catch (err) {
            setError(getErrorMessage(err, "Failed to add vault record"));
        }
    };

    const handleDeleteVault = async (id: string) => {
        setError(null);
        setStatus(null);
        try {
            await apiFetch(`/api/secure-vault/${id}`, { method: "DELETE", skipJson: true });
            setVaultRecords((prev) => prev.filter((record) => record.id !== id));
            setStatus("Vault record removed.");
        } catch (err) {
            setError(getErrorMessage(err, "Failed to delete vault record"));
        }
    };

    const handleAddAccount = async () => {
        setError(null);
        setStatus(null);
        if (!accountDraft.label.trim()) {
            setError("Account label is required.");
            return;
        }
        try {
            const created = await apiFetch<UserAccount>("/api/user-accounts", {
                method: "POST",
                body: JSON.stringify({
                    label: accountDraft.label.trim(),
                    bankName: accountDraft.bankName || undefined,
                    accountType: accountDraft.accountType || "bank",
                    accountNumber: accountDraft.accountNumber || undefined,
                    sortCode: accountDraft.sortCode || undefined,
                    currency: accountDraft.currency || undefined,
                    balance: accountDraft.balance ? Number(accountDraft.balance) : undefined,
                    limit: accountDraft.limit ? Number(accountDraft.limit) : undefined,
                    status: accountDraft.status || "active",
                    linkedBankAccountId: accountDraft.linkedBankAccountId || undefined,
                    secureRecordId: accountDraft.secureRecordId || undefined,
                }),
            });
            setUserAccounts((prev) => [created, ...prev]);
            setAccountDraft({
                label: "",
                bankName: "",
                accountType: "bank",
                accountNumber: "",
                sortCode: "",
                currency: "",
                balance: "",
                limit: "",
                status: "active",
                linkedBankAccountId: "",
                secureRecordId: "",
            });
            setStatus("User account added.");
        } catch (err) {
            setError(getErrorMessage(err, "Failed to add user account"));
        }
    };

    const handleDeleteAccount = async (id: string) => {
        setError(null);
        setStatus(null);
        try {
            await apiFetch(`/api/user-accounts/${id}`, { method: "DELETE", skipJson: true });
            setUserAccounts((prev) => prev.filter((acct) => acct.id !== id));
            setStatus("User account removed.");
        } catch (err) {
            setError(getErrorMessage(err, "Failed to delete user account"));
        }
    };

    const handleAddCard = async () => {
        setError(null);
        setStatus(null);
        if (!cardDraft.label.trim()) {
            setError("Card label is required.");
            return;
        }
        try {
            const created = await apiFetch<UserCard>("/api/user-cards", {
                method: "POST",
                body: JSON.stringify({
                    label: cardDraft.label.trim(),
                    cardType: cardDraft.cardType || "credit",
                    issuerBankName: cardDraft.issuerBankName || undefined,
                    network: cardDraft.network || undefined,
                    last4: cardDraft.last4 || undefined,
                    statementDay: cardDraft.statementDay ? Number(cardDraft.statementDay) : undefined,
                    dueDay: cardDraft.dueDay ? Number(cardDraft.dueDay) : undefined,
                    status: cardDraft.status || "active",
                    linkedBankAccountId: cardDraft.linkedBankAccountId || undefined,
                    secureRecordId: cardDraft.secureRecordId || undefined,
                }),
            });
            setUserCards((prev) => [created, ...prev]);
            setCardDraft({
                label: "",
                cardType: "credit",
                issuerBankName: "",
                network: "",
                last4: "",
                statementDay: "",
                dueDay: "",
                status: "active",
                linkedBankAccountId: "",
                secureRecordId: "",
            });
            setStatus("User card added.");
        } catch (err) {
            setError(getErrorMessage(err, "Failed to add user card"));
        }
    };

    const handleDeleteCard = async (id: string) => {
        setError(null);
        setStatus(null);
        try {
            await apiFetch(`/api/user-cards/${id}`, { method: "DELETE", skipJson: true });
            setUserCards((prev) => prev.filter((card) => card.id !== id));
            setStatus("User card removed.");
        } catch (err) {
            setError(getErrorMessage(err, "Failed to delete user card"));
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Secure Assets</h2>
                    <p className="text-sm text-muted-foreground">Server-side secure vault records, user accounts, and cards.</p>
                </div>
                <Button variant="outline" onClick={loadData} disabled={loading}>
                    {loading ? "Refreshing..." : "Refresh"}
                </Button>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {status && <p className="text-sm text-emerald-600">{status}</p>}

            <Card>
                <CardHeader>
                    <CardTitle>Secure Vault Records</CardTitle>
                    <CardDescription>Encrypted payloads stored on the server. You control the passphrase.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Record type</Label>
                            <Select
                                value={vaultDraft.recordType}
                                onValueChange={(value) => setVaultDraft((prev) => ({ ...prev, recordType: value as SecureRecordType }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {RECORD_TYPES.map((type) => (
                                        <SelectItem key={type} value={type}>
                                            {type}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Label</Label>
                            <Input value={vaultDraft.label} onChange={(e) => setVaultDraft((prev) => ({ ...prev, label: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Bank name</Label>
                            <Input value={vaultDraft.bankName} onChange={(e) => setVaultDraft((prev) => ({ ...prev, bankName: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Account number</Label>
                            <Input value={vaultDraft.accountNumber} onChange={(e) => setVaultDraft((prev) => ({ ...prev, accountNumber: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Sort code</Label>
                            <Input value={vaultDraft.sortCode} onChange={(e) => setVaultDraft((prev) => ({ ...prev, sortCode: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Card last 4</Label>
                            <Input value={vaultDraft.cardLast4} onChange={(e) => setVaultDraft((prev) => ({ ...prev, cardLast4: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Username</Label>
                            <Input value={vaultDraft.username} onChange={(e) => setVaultDraft((prev) => ({ ...prev, username: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Passphrase</Label>
                            <Input type="password" value={vaultDraft.passphrase} onChange={(e) => setVaultDraft((prev) => ({ ...prev, passphrase: e.target.value }))} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Payload JSON (encrypted)</Label>
                        <Textarea
                            rows={6}
                            value={vaultDraft.payloadJson}
                            onChange={(e) => setVaultDraft((prev) => ({ ...prev, payloadJson: e.target.value }))}
                        />
                    </div>
                    <Button onClick={handleAddVault}>Add vault record</Button>
                    <div className="space-y-2">
                        {vaultRecords.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No secure vault records yet.</p>
                        ) : (
                            vaultRecords.map((record) => (
                                <div key={record.id} className="flex items-center justify-between rounded border p-3">
                                    <div>
                                        <div className="text-sm font-semibold">{record.label}</div>
                                        <div className="text-xs text-muted-foreground">{record.recordType} · {record.status || "active"}</div>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => handleDeleteVault(record.id)}>
                                        Delete
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>User Accounts</CardTitle>
                    <CardDescription>Manual bank/overdraft accounts linked to secure records or TrueLayer accounts.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Label</Label>
                            <Input value={accountDraft.label} onChange={(e) => setAccountDraft((prev) => ({ ...prev, label: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Account type</Label>
                            <Input value={accountDraft.accountType} onChange={(e) => setAccountDraft((prev) => ({ ...prev, accountType: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Bank name</Label>
                            <Input value={accountDraft.bankName} onChange={(e) => setAccountDraft((prev) => ({ ...prev, bankName: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Account number</Label>
                            <Input value={accountDraft.accountNumber} onChange={(e) => setAccountDraft((prev) => ({ ...prev, accountNumber: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Sort code</Label>
                            <Input value={accountDraft.sortCode} onChange={(e) => setAccountDraft((prev) => ({ ...prev, sortCode: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Currency</Label>
                            <Input value={accountDraft.currency} onChange={(e) => setAccountDraft((prev) => ({ ...prev, currency: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Balance</Label>
                            <Input value={accountDraft.balance} onChange={(e) => setAccountDraft((prev) => ({ ...prev, balance: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Limit</Label>
                            <Input value={accountDraft.limit} onChange={(e) => setAccountDraft((prev) => ({ ...prev, limit: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Secure record id (optional)</Label>
                            <Select
                                value={accountDraft.secureRecordId}
                                onValueChange={(value) => setAccountDraft((prev) => ({ ...prev, secureRecordId: value }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select secure record" />
                                </SelectTrigger>
                                <SelectContent>
                                    {secureRecordOptions.map((record) => (
                                        <SelectItem key={record.value} value={record.value}>
                                            {record.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Linked bank account id (optional)</Label>
                            <Input value={accountDraft.linkedBankAccountId} onChange={(e) => setAccountDraft((prev) => ({ ...prev, linkedBankAccountId: e.target.value }))} />
                        </div>
                    </div>
                    <Button onClick={handleAddAccount}>Add user account</Button>
                    <div className="space-y-2">
                        {userAccounts.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No user accounts yet.</p>
                        ) : (
                            userAccounts.map((acct) => (
                                <div key={acct.id} className="flex items-center justify-between rounded border p-3">
                                    <div>
                                        <div className="text-sm font-semibold">{acct.label}</div>
                                        <div className="text-xs text-muted-foreground">{acct.accountType || "bank"} · {acct.status || "active"}</div>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => handleDeleteAccount(acct.id)}>
                                        Delete
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>User Cards</CardTitle>
                    <CardDescription>Manual debit/credit cards linked to secure records or TrueLayer accounts.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Label</Label>
                            <Input value={cardDraft.label} onChange={(e) => setCardDraft((prev) => ({ ...prev, label: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Card type</Label>
                            <Input value={cardDraft.cardType} onChange={(e) => setCardDraft((prev) => ({ ...prev, cardType: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Issuer bank</Label>
                            <Input value={cardDraft.issuerBankName} onChange={(e) => setCardDraft((prev) => ({ ...prev, issuerBankName: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Network</Label>
                            <Input value={cardDraft.network} onChange={(e) => setCardDraft((prev) => ({ ...prev, network: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Last 4</Label>
                            <Input value={cardDraft.last4} onChange={(e) => setCardDraft((prev) => ({ ...prev, last4: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Statement day</Label>
                            <Input value={cardDraft.statementDay} onChange={(e) => setCardDraft((prev) => ({ ...prev, statementDay: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Due day</Label>
                            <Input value={cardDraft.dueDay} onChange={(e) => setCardDraft((prev) => ({ ...prev, dueDay: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Secure record id (optional)</Label>
                            <Select
                                value={cardDraft.secureRecordId}
                                onValueChange={(value) => setCardDraft((prev) => ({ ...prev, secureRecordId: value }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select secure record" />
                                </SelectTrigger>
                                <SelectContent>
                                    {secureRecordOptions.map((record) => (
                                        <SelectItem key={record.value} value={record.value}>
                                            {record.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Linked bank account id (optional)</Label>
                            <Input value={cardDraft.linkedBankAccountId} onChange={(e) => setCardDraft((prev) => ({ ...prev, linkedBankAccountId: e.target.value }))} />
                        </div>
                    </div>
                    <Button onClick={handleAddCard}>Add user card</Button>
                    <div className="space-y-2">
                        {userCards.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No user cards yet.</p>
                        ) : (
                            userCards.map((card) => (
                                <div key={card.id} className="flex items-center justify-between rounded border p-3">
                                    <div>
                                        <div className="text-sm font-semibold">{card.label}</div>
                                        <div className="text-xs text-muted-foreground">{card.cardType || "credit"} · {card.status || "active"}</div>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => handleDeleteCard(card.id)}>
                                        Delete
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
