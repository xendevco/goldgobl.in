import type { PriceQuote } from "@/types/api";

export const PRICE_TTL_MS = 15 * 60 * 1000;

type CachedQuote = PriceQuote & { cachedAt: number };

function keyFor(region: string, itemId: number, connectedRealmId?: number | null): string {
  return `gg:price:${region}:${connectedRealmId ?? "commodity"}:${itemId}`;
}

export function readCachedQuote(
  region: string,
  itemId: number,
  connectedRealmId?: number | null,
): CachedQuote | null {
  const raw = localStorage.getItem(keyFor(region, itemId, connectedRealmId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CachedQuote;
  } catch {
    return null;
  }
}

export function writeCachedQuotes(
  region: string,
  quotes: PriceQuote[],
  connectedRealmId?: number | null,
  cachedAt = Date.now(),
): void {
  for (const quote of quotes) {
    const cached: CachedQuote = { ...quote, cachedAt };
    localStorage.setItem(keyFor(region, quote.itemId, connectedRealmId), JSON.stringify(cached));
  }
}

export function isFresh(cached: CachedQuote, now = Date.now()): boolean {
  return now - cached.cachedAt < PRICE_TTL_MS;
}
