const EMBEDDED_CONTEXT_KEYS = [
  "shop",
  "host",
  "embedded",
  "hmac",
  "id_token",
  "session",
] as const;

export function hasShopifyEmbeddedContext(url: URL) {
  return EMBEDDED_CONTEXT_KEYS.some((key) => url.searchParams.has(key));
}

export function embeddedAppRedirectTarget(url: URL, fallbackPath = "/app") {
  const query = url.searchParams.toString();
  return query ? `${fallbackPath}?${query}` : fallbackPath;
}

export function logEmbeddedAuthContext(request: Request, label: string) {
  if (process.env.SHOPIFY_DEBUG_AUTH !== "true") {
    return;
  }

  const url = new URL(request.url);
  const presentKeys = EMBEDDED_CONTEXT_KEYS.filter((key) => url.searchParams.has(key));
  console.info(`[shopify-auth:${label}]`, {
    path: url.pathname,
    hasEmbeddedContext: presentKeys.length > 0,
    presentKeys,
  });
}
