import type { NextRequest } from "next/server";

const DEFAULT_API_BASE_URL = "http://localhost:8081";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; index: string }> }
) {
  const { id, index } = await context.params;
  const baseUrl =
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    DEFAULT_API_BASE_URL;
  const token = request.cookies.get("cardsense_token")?.value;

  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const search = request.nextUrl.search;
  const upstream = await fetch(
    `${baseUrl}/api/account-meta/${encodeURIComponent(id)}/documents/${encodeURIComponent(index)}${search}`,
    { headers, cache: "no-store" }
  );

  const responseHeaders = new Headers();
  const contentType = upstream.headers.get("content-type");
  const contentDisposition = upstream.headers.get("content-disposition");
  const cacheControl = upstream.headers.get("cache-control");

  if (contentType) responseHeaders.set("content-type", contentType);
  if (contentDisposition) responseHeaders.set("content-disposition", contentDisposition);
  if (cacheControl) responseHeaders.set("cache-control", cacheControl);

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
