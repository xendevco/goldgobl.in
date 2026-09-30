import { isFresh, readCachedQuote, writeCachedQuotes } from "@/lib/cache";
import type { HealthResponse, PriceQuote, PriceResponse, Realm } from "@/types/api";
import type { Region } from "@/types/character";

// NordVPN's resolvers still answer NXDOMAIN for api.goldgobl.in. The workers.dev host resolves and serves the same worker.
const API_BASE =
  import.meta.env.VITE_API_BASE ??
  (import.meta.env.DEV ? "/api" : "https://goldgoblin-api.xbramford-cloudflare.workers.dev");

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      message = response.statusText;
    }
    throw new ApiError(response.status, message);
  }
  return response.json() as Promise<T>;
}

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/health");
}

export function getRealms(region: Region): Promise<Realm[]> {
  return request<{ realms: Realm[] }>(`/v1/realms?region=${region}`).then((body) => body.realms);
}

export async function getPrices(options: {
  region: Region;
  itemIds: number[];
  connectedRealmId?: number | null;
}): Promise<{ quotes: PriceQuote[]; stale: boolean }> {
  const itemIds = [...new Set(options.itemIds)].filter((id) => id > 0).sort((a, b) => a - b);
  const realmId = options.connectedRealmId ?? null;
  if (itemIds.length === 0) return { quotes: [], stale: false };

  const path = `/v1/prices?region=${options.region}&itemIds=${itemIds.join(",")}${
    realmId ? `&connectedRealmId=${realmId}` : ""
  }`;

  try {
    const body = await request<PriceResponse>(path);
    writeCachedQuotes(options.region, body.quotes, realmId);
    return { quotes: body.quotes, stale: false };
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 0;
    const cached = itemIds
      .map((itemId) => readCachedQuote(options.region, itemId, realmId))
      .filter((quote): quote is NonNullable<typeof quote> => quote != null);
    if ((status === 429 || status === 0) && cached.length === itemIds.length) {
      return {
        quotes: cached.map(({ cachedAt: _cachedAt, ...quote }) => quote),
        stale: true,
      };
    }
    const fresh = cached.filter((quote) => isFresh(quote));
    if (fresh.length === itemIds.length) {
      return {
        quotes: fresh.map(({ cachedAt: _cachedAt, ...quote }) => quote),
        stale: false,
      };
    }
    throw error;
  }
}
