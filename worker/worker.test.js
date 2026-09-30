import assert from "node:assert/strict";
import test from "node:test";
import worker, { auctionSnapshotTime, authorise, fixtureQuote, parseTsmSaleRates, rateLimit, reduceAuctions } from "./worker.js";

test("authorise stays on the free tier when no JWT secret is configured", async () => {
  const result = await authorise(new Request("https://api.goldgobl.in/health"), {});
  assert.deepEqual(result, { ok: true, tier: "free" });
});

test("authorise accepts a premium HS256 token and rejects a bad signature", async () => {
  const secret = "test-secret";
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })).replace(/=+$/g, "");
  const payload = btoa(JSON.stringify({ tier: "premium", exp: Math.floor(Date.now() / 1000) + 60 }))
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${payload}`));
  const encoded = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  const token = `${header}.${payload}.${encoded}`;
  const ok = await authorise(
    new Request("https://api.goldgobl.in/health", { headers: { authorization: `Bearer ${token}` } }),
    { JWT_SECRET: secret },
  );
  assert.equal(ok.tier, "premium");

  const bad = await authorise(
    new Request("https://api.goldgobl.in/health", { headers: { authorization: "Bearer a.b.c" } }),
    { JWT_SECRET: secret },
  );
  assert.equal(bad.ok, false);
});

test("rateLimit is a pass-through hook", () => {
  assert.deepEqual(rateLimit("free"), { allowed: true, tier: "free" });
});

test("fixture prices do not echo secrets", async () => {
  const response = await worker.fetch(
    new Request("https://api.goldgobl.in/v1/prices?region=eu&itemIds=256963"),
    {
      FIXTURE_MODE: "1",
      BLIZZARD_CLIENT_SECRET: "super-secret-value",
      TSM_API_KEY: "tsm-secret-value",
    },
  );
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.equal(body.includes("super-secret-value"), false);
  assert.equal(body.includes("tsm-secret-value"), false);
  const payload = JSON.parse(body);
  assert.equal(payload.quotes[0].itemId, 256963);
  assert.equal(payload.quotes[0].source, "fixture");
});

test("health reports the free tier", async () => {
  const response = await worker.fetch(new Request("https://api.goldgobl.in/health"), { FIXTURE_MODE: "1" });
  assert.deepEqual(await response.json(), { ok: true, tier: "free", service: "goldgoblin-api" });
});

test("live routes refuse to run without upstream secrets", async () => {
  const response = await worker.fetch(
    new Request("https://api.goldgobl.in/v1/prices?region=eu&itemIds=256963"),
    { FIXTURE_MODE: "0" },
  );
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "upstream_not_configured" });
});

test("realm prices diverge so arbitrage has a spread", () => {
  const home = fixtureQuote(262601, 101);
  const remote = fixtureQuote(262601, 102);
  assert.notEqual(home.marketValue, remote.marketValue);
});

test("parseTsmSaleRates reads the public region CSV", () => {
  const csv = [
    "itemId,name,marketValue,historical,avgSalePrice,saleRate,soldPerDay,updatedAt",
    '262601,Wild Hanging Scroll,89927300,124848750,37999905,0.022,0.11,2026-09-30T00:33:37Z',
    '3042,"BKP ""Sparrow"" Smallbore",2712401,2634800,479038,0.036,0.036,2026-09-30T00:33:37Z',
    "256963,Thalassian Lumber,1,1,1,not-a-rate,0,2026-09-30T00:33:37Z",
  ].join("\n");
  const rates = parseTsmSaleRates(csv);
  assert.equal(rates[262601].saleRate, 0.022);
  assert.equal(rates[262601].soldPerDay, 0.11);
  assert.equal(rates[3042].saleRate, 0.036);
  assert.equal(rates[256963], undefined);
});

test("auctionSnapshotTime prefers the auction house last-modified header", () => {
  const headers = new Headers({ "last-modified": "Wed, 30 Sep 2026 07:41:00 GMT" });
  assert.equal(auctionSnapshotTime(headers, new Date("2026-09-30T08:00:00Z")), "2026-09-30T07:41:00.000Z");
});

test("reduceAuctions keeps the cheapest unit price", () => {
  const prices = reduceAuctions({
    auctions: [
      { item: { id: 5 }, unit_price: 40, quantity: 1 },
      { item: { id: 5 }, buyout: 90, quantity: 3 },
      { item: { id: 9 }, buyout: 10, quantity: 1 },
    ],
  });
  assert.equal(prices.get(5), 30);
  assert.equal(prices.get(9), 10);
});
