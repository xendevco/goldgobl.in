/**
 * GoldGobl.in API proxy.
 * Secrets stay in Wrangler bindings and are never written into responses.
 */

const ALLOWED_ORIGINS = new Set([
  "https://goldgobl.in",
  "https://www.goldgobl.in",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const REGIONS = {
  eu: {
    api: "https://eu.api.blizzard.com",
    oauth: "https://eu.battle.net/oauth/token",
    namespace: "dynamic-eu",
    locale: "en_GB",
  },
  us: {
    api: "https://us.api.blizzard.com",
    oauth: "https://oauth.battle.net/token",
    namespace: "dynamic-us",
    locale: "en_US",
  },
  kr: {
    api: "https://kr.api.blizzard.com",
    oauth: "https://kr.battle.net/oauth/token",
    namespace: "dynamic-kr",
    locale: "ko_KR",
  },
  tw: {
    api: "https://tw.api.blizzard.com",
    oauth: "https://tw.battle.net/oauth/token",
    namespace: "dynamic-tw",
    locale: "zh_TW",
  },
};

const FIXTURE_REALMS = {
  eu: [
    { id: 101, name: "Silvermoon", region: "eu" },
    { id: 102, name: "Draenor", region: "eu" },
    { id: 103, name: "Kazzak", region: "eu" },
    { id: 104, name: "Tarren Mill", region: "eu" },
    { id: 105, name: "Ravencrest", region: "eu" },
    { id: 106, name: "Twisting Nether", region: "eu" },
  ],
  us: [
    { id: 201, name: "Area 52", region: "us" },
    { id: 202, name: "Illidan", region: "us" },
    { id: 203, name: "Stormrage", region: "us" },
    { id: 204, name: "Tichondrius", region: "us" },
  ],
  kr: [{ id: 301, name: "Azshara", region: "kr" }],
  tw: [{ id: 401, name: "Arthas", region: "tw" }],
};

/** Copper unit prices used when FIXTURE_MODE=1. */
const FIXTURE_COPPER = {
  256963: 250000,
  245764: 800000,
  245766: 600000,
  243578: 450000,
  243581: 300000,
  243574: 200000,
  243576: 900000,
  236950: 150000,
  241280: 400000,
  262601: 5000000,
  263049: 8000000,
  262356: 2000000,
};

const MAX_UPSTREAM_BYTES = 20_000_000;

export function rateLimit(tier) {
  // KV-backed per-token limits attach here when a paid tier needs them.
  return { allowed: true, tier };
}

function timingSafeEqualBytes(left, right) {
  if (left.length !== right.length) return false;
  if (typeof crypto.subtle.timingSafeEqual === "function") {
    return crypto.subtle.timingSafeEqual(left, right);
  }
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function signHs256(data, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function authorise(request, env) {
  if (!env.JWT_SECRET) return { ok: true, tier: "free" };

  const header = request.headers.get("Authorization") ?? "";
  if (!header.startsWith("Bearer ")) return { ok: true, tier: "free" };

  const token = header.slice("Bearer ".length).trim();
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, tier: "free", error: "invalid_token" };

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  let headerJson;
  try {
    headerJson = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encodedHeader)));
  } catch {
    return { ok: false, tier: "free", error: "invalid_token" };
  }
  if (headerJson.alg !== "HS256") return { ok: false, tier: "free", error: "invalid_token" };

  const expected = await signHs256(`${encodedHeader}.${encodedPayload}`, env.JWT_SECRET);
  const actualBytes = base64UrlToBytes(encodedSignature);
  const expectedBytes = base64UrlToBytes(expected);
  if (!timingSafeEqualBytes(actualBytes, expectedBytes)) {
    return { ok: false, tier: "free", error: "invalid_token" };
  }

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encodedPayload)));
  } catch {
    return { ok: false, tier: "free", error: "invalid_token" };
  }
  if (typeof payload.exp === "number" && Date.now() / 1000 > payload.exp) {
    return { ok: false, tier: "free", error: "invalid_token" };
  }

  return { ok: true, tier: payload.tier === "premium" ? "premium" : "free" };
}

function corsHeaders(origin) {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://goldgobl.in";
  return {
    "access-control-allow-origin": allow,
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "Authorization, Content-Type, X-Goldgoblin-Force-Status",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...corsHeaders(origin),
    },
  });
}

function regionOf(value) {
  return REGIONS[value] ? value : null;
}

function fixtureMode(env) {
  return env.FIXTURE_MODE === "1";
}

function missingSecrets(env) {
  return !env.BLIZZARD_CLIENT_ID || !env.BLIZZARD_CLIENT_SECRET;
}

export function fixtureQuote(itemId, connectedRealmId) {
  const base = FIXTURE_COPPER[itemId] ?? 100000;
  const skew = connectedRealmId ? (connectedRealmId % 17) * 0.03 : 0;
  const decor = itemId === 262601 || itemId === 263049 || itemId === 262356;
  return {
    itemId,
    marketValue: Math.round(base * (1 + skew)),
    saleRate: decor ? 0.25 : 0.4,
    updatedAt: new Date().toISOString(),
    source: "fixture",
  };
}

function parseItemIds(value) {
  if (!value) return [];
  const ids = [];
  for (const part of value.split(",")) {
    const id = Number(part);
    if (Number.isInteger(id) && id > 0) ids.push(id);
  }
  return [...new Set(ids)].slice(0, 200);
}

async function readBoundedJson(response) {
  const length = Number(response.headers.get("content-length") || 0);
  if (length > MAX_UPSTREAM_BYTES) {
    throw new Error("payload_too_large");
  }
  return response.json();
}

async function blizzardToken(env, region) {
  const cacheKey = new Request(`https://goldgoblin-cache.internal/blizzard-token/${region}`);
  const cached = await caches.default.match(cacheKey);
  if (cached) return cached.text();

  const host = REGIONS[region];
  const basic = btoa(`${env.BLIZZARD_CLIENT_ID}:${env.BLIZZARD_CLIENT_SECRET}`);
  const response = await fetch(host.oauth, {
    method: "POST",
    headers: {
      authorization: `Basic ${basic}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) throw new Error("token_failed");
  const payload = await response.json();
  const token = payload.access_token;
  if (!token) throw new Error("token_failed");
  await caches.default.put(
    cacheKey,
    new Response(token, { headers: { "cache-control": "max-age=3000" } }),
  );
  return token;
}

function auctionUnitPrice(auction) {
  if (typeof auction.unit_price === "number") return auction.unit_price;
  if (typeof auction.buyout === "number") {
    const quantity = auction.quantity || 1;
    return Math.floor(auction.buyout / quantity);
  }
  return null;
}

export function reduceAuctions(payload) {
  const best = new Map();
  const auctions = Array.isArray(payload?.auctions) ? payload.auctions : [];
  for (const auction of auctions) {
    const itemId = auction?.item?.id;
    const unit = auctionUnitPrice(auction);
    if (!itemId || unit == null) continue;
    const previous = best.get(itemId);
    if (previous == null || unit < previous) best.set(itemId, unit);
  }
  return best;
}

async function blizzardPrices(env, region, itemIds, connectedRealmId) {
  const host = REGIONS[region];
  const token = await blizzardToken(env, region);
  const path = connectedRealmId
    ? `/data/wow/connected-realm/${connectedRealmId}/auctions`
    : "/data/wow/auctions/commodities";
  const url = new URL(path, host.api);
  url.searchParams.set("namespace", host.namespace);
  url.searchParams.set("locale", host.locale);
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (response.status === 429) return { rateLimited: true, prices: new Map() };
  if (!response.ok) throw new Error("blizzard_failed");
  const prices = reduceAuctions(await readBoundedJson(response));
  const wanted = new Set(itemIds);
  if (wanted.size === 0) return { rateLimited: false, prices };
  const filtered = new Map();
  for (const id of wanted) {
    if (prices.has(id)) filtered.set(id, prices.get(id));
  }
  return { rateLimited: false, prices: filtered };
}

function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

export function parseTsmSaleRates(csv) {
  const rates = {};
  const lines = String(csv).split(/\r?\n/);
  const header = parseCsvLine(lines[0] || "");
  const idIndex = header.indexOf("itemId");
  const rateIndex = header.indexOf("saleRate");
  if (idIndex < 0 || rateIndex < 0) return rates;
  for (let index = 1; index < lines.length; index += 1) {
    if (!lines[index]) continue;
    const fields = parseCsvLine(lines[index]);
    const itemId = Number(fields[idIndex]);
    const saleRate = Number(fields[rateIndex]);
    if (!Number.isInteger(itemId) || itemId <= 0 || !Number.isFinite(saleRate)) continue;
    rates[itemId] = saleRate;
  }
  return rates;
}

async function tsmSaleRates(region, itemIds) {
  if (itemIds.length === 0 || !REGIONS[region]) return new Map();
  const cacheKey = new Request(`https://goldgoblin-cache.internal/tsm-sale-rates/${region}`);
  const cached = await caches.default.match(cacheKey);
  let rates = cached ? await cached.json() : null;
  if (!rates) {
    const response = await fetch(`https://public-data.tradeskillmaster.com/retail/${region}/region/items.csv`);
    if (!response.ok) return new Map();
    const length = Number(response.headers.get("content-length") || 0);
    if (length > MAX_UPSTREAM_BYTES) return new Map();
    rates = parseTsmSaleRates(await response.text());
    if (Object.keys(rates).length === 0) return new Map();
    await caches.default.put(
      cacheKey,
      new Response(JSON.stringify(rates), { headers: { "cache-control": "max-age=21600" } }),
    );
  }
  const quotes = new Map();
  for (const itemId of itemIds) {
    const saleRate = rates[itemId];
    if (typeof saleRate === "number") quotes.set(itemId, saleRate);
  }
  return quotes;
}

async function liveQuotes(env, region, itemIds, connectedRealmId) {
  if (missingSecrets(env)) {
    return { error: "upstream_not_configured", status: 503, quotes: [] };
  }
  const blizzard = await blizzardPrices(env, region, itemIds, connectedRealmId);
  if (blizzard.rateLimited) return { error: "rate_limited", status: 429, quotes: [] };
  let saleRates = new Map();
  try {
    saleRates = await tsmSaleRates(region, itemIds);
  } catch {
    saleRates = new Map();
  }
  const now = new Date().toISOString();
  const quotes = itemIds.map((itemId) => ({
    itemId,
    marketValue: blizzard.prices.get(itemId) ?? null,
    saleRate: saleRates.get(itemId) ?? null,
    updatedAt: now,
    source: "blizzard",
  }));
  return { quotes, status: 200 };
}

function localisedName(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  return value.en_GB || value.en_US || Object.values(value).find((entry) => typeof entry === "string") || "";
}

function connectedRealmName(document) {
  const realms = document?.realms || [];
  const names = realms.map((realm) => localisedName(realm?.name)).filter(Boolean);
  return [...new Set(names)].join(", ");
}

async function searchConnectedRealms(env, region) {
  const host = REGIONS[region];
  const token = await blizzardToken(env, region);
  const realms = [];
  for (let page = 1; page <= 10; page += 1) {
    const url = new URL("/data/wow/search/connected-realm", host.api);
    url.searchParams.set("namespace", host.namespace);
    url.searchParams.set("locale", host.locale);
    url.searchParams.set("orderby", "id");
    url.searchParams.set("_pageSize", "100");
    url.searchParams.set("_page", String(page));
    const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error("realms_failed");
    const payload = await readBoundedJson(response);
    const results = Array.isArray(payload.results) ? payload.results : [];
    for (const result of results) {
      const data = result?.data || {};
      const id = Number(data.id);
      if (!id) continue;
      realms.push({ id, name: connectedRealmName(data) || `Connected realm ${id}`, region });
    }
    const pageCount = Number(payload.pageCount) || 1;
    if (page >= pageCount || results.length === 0) break;
  }
  return realms.sort((left, right) => left.name.localeCompare(right.name) || left.id - right.id);
}

async function liveRealms(env, region) {
  if (missingSecrets(env)) return { error: "upstream_not_configured", status: 503, realms: [] };
  const cacheKey = new Request(`https://goldgoblin-cache.internal/realms/${region}`);
  const cached = await caches.default.match(cacheKey);
  if (cached) return { realms: await cached.json(), status: 200 };
  const realms = await searchConnectedRealms(env, region);
  if (realms.length === 0) return { error: "realms_failed", status: 502, realms: [] };
  await caches.default.put(
    cacheKey,
    new Response(JSON.stringify(realms), { headers: { "cache-control": "max-age=43200" } }),
  );
  return { realms, status: 200 };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, origin);

    try {
      const auth = await authorise(request, env);
      if (!auth.ok) return json({ error: auth.error ?? "unauthorised" }, 401, origin);
      const limited = rateLimit(auth.tier);
      if (!limited.allowed) return json({ error: "rate_limited" }, 429, origin);

      const url = new URL(request.url);
      if (fixtureMode(env) && (url.searchParams.get("forceStatus") === "429" || request.headers.get("X-Goldgoblin-Force-Status") === "429")) {
        return json({ error: "rate_limited" }, 429, origin);
      }

      if (url.pathname === "/health") {
        return json({ ok: true, tier: auth.tier, service: "goldgoblin-api" }, 200, origin);
      }

      const region = regionOf(url.searchParams.get("region"));
      if (url.pathname.startsWith("/v1/") && !region) {
        return json({ error: "invalid_region" }, 400, origin);
      }

      if (url.pathname === "/v1/realms") {
        if (fixtureMode(env)) return json({ region, realms: FIXTURE_REALMS[region] }, 200, origin);
        const result = await liveRealms(env, region);
        if (result.error) return json({ error: result.error }, result.status, origin);
        return json({ region, realms: result.realms }, 200, origin);
      }

      if (url.pathname === "/v1/commodities" || url.pathname === "/v1/auctions" || url.pathname === "/v1/prices") {
        const itemIds = parseItemIds(url.searchParams.get("itemIds"));
        const connectedRealmId = Number(url.searchParams.get("connectedRealmId")) || null;
        if (url.pathname === "/v1/auctions" && !connectedRealmId) {
          return json({ error: "connected_realm_required" }, 400, origin);
        }
        if (fixtureMode(env)) {
          const ids = itemIds.length ? itemIds : Object.keys(FIXTURE_COPPER).map(Number);
          const realmForSkew = url.pathname === "/v1/commodities" ? null : connectedRealmId;
          return json({
            region,
            connectedRealmId: realmForSkew,
            quotes: ids.map((itemId) => fixtureQuote(itemId, realmForSkew)),
          }, 200, origin);
        }
        const result = await liveQuotes(
          env,
          region,
          itemIds.length ? itemIds : [],
          url.pathname === "/v1/commodities" ? null : connectedRealmId,
        );
        if (result.error) return json({ error: result.error }, result.status, origin);
        return json({
          region,
          connectedRealmId: url.pathname === "/v1/commodities" ? null : connectedRealmId,
          quotes: result.quotes,
        }, 200, origin);
      }

      return json({ error: "not_found" }, 404, origin);
    } catch {
      return json({ error: "internal_error" }, 500, origin);
    }
  },
};
