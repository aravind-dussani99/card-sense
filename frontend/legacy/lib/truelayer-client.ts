const AUTH_BASE = process.env.TRUELAYER_AUTH_BASE || "https://auth.truelayer-sandbox.com";
const API_BASE = process.env.TRUELAYER_API_BASE || "https://api.truelayer-sandbox.com";

export async function exchangeCodeForTokens(code: string, redirectUri: string) {
    const body = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.TRUELAYER_CLIENT_ID || "",
        client_secret: process.env.TRUELAYER_CLIENT_SECRET || "",
        redirect_uri: redirectUri,
        code,
    });

    const res = await fetch(`${AUTH_BASE}/connect/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`TrueLayer token exchange failed: ${res.status} ${text}`);
    }
    return res.json() as Promise<{
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        scope?: string;
        token_type?: string;
    }>;
}

export async function fetchInfo(accessToken: string) {
    const res = await fetch(`${API_BASE}/data/v1/info`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`TrueLayer info failed: ${res.status} ${text}`);
    }
    const data = await res.json();
    return (data as any)?.results?.[0] || null;
}

export async function fetchAccounts(accessToken: string) {
    const res = await fetch(`${API_BASE}/data/v1/accounts`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`TrueLayer accounts failed: ${res.status} ${text}`);
    }
    const data = await res.json();
    return (data as any)?.results || [];
}

export async function fetchCards(accessToken: string) {
    const res = await fetch(`${API_BASE}/data/v1/cards`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`TrueLayer cards failed: ${res.status} ${text}`);
    }
    const data = await res.json();
    return (data as any)?.results || [];
}

export async function fetchTransactions(accessToken: string, accountId: string, fromDate?: string, toDate?: string) {
    const params = new URLSearchParams();
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    const url = `${API_BASE}/data/v1/accounts/${accountId}/transactions?${params.toString()}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`TrueLayer transactions failed: ${res.status} ${text}`);
    }
    const data = await res.json();
    return (data as any)?.results || [];
}
