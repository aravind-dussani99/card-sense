const DEFAULT_API_BASE_URL = "http://localhost:8081";

export function getApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.API_BASE_URL ||
    DEFAULT_API_BASE_URL
  );
}

type FetchOptions = RequestInit & { skipJson?: boolean };

export async function apiFetch<T>(path: string, options: FetchOptions = {}) {
  const baseUrl = getApiBaseUrl();
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (!headers.has("Authorization")) {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("cardsense_token") || "";
      if (token) headers.set("Authorization", `Bearer ${token}`);
    } else {
      try {
        const { cookies } = await import("next/headers");
        const cookieStore = await cookies();
        const token = cookieStore.get("cardsense_token")?.value;
        if (token) headers.set("Authorization", `Bearer ${token}`);
      } catch {
        // ignore when headers API isn't available
      }
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
    cache: options.cache ?? "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}`);
  }

  if (options.skipJson) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
