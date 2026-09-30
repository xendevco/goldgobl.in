import { useEffect, useState } from "react";
import { PriceStamp } from "@/components/PriceStamp";
import { Badge } from "@/components/ui/badge";
import { RealmPicker } from "@/components/RealmPicker";
import { SortableTable } from "@/components/SortableTable";
import { arbitrageWatchlist } from "@/data/watchlist";
import { getPrices, getRealms } from "@/lib/api";
import { arbitrageSpread, expectedArbitrage, rankSpreads, type SpreadRow } from "@/lib/arbitrage";
import { earlierAsOf, formatCopper, formatPercent } from "@/lib/format";
import { useRoster } from "@/stores/roster";
import type { Realm } from "@/types/api";

export function ArbitragePage() {
  const region = useRoster((state) => state.settings.region);
  const homeRealmId = useRoster((state) => state.settings.homeRealmId);
  const watchRealmIds = useRoster((state) => state.settings.watchRealmIds);
  const setHomeRealmId = useRoster((state) => state.setHomeRealmId);
  const toggleWatchRealm = useRoster((state) => state.toggleWatchRealm);
  const setWatchRealmIds = useRoster((state) => state.setWatchRealmIds);
  const [realms, setRealms] = useState<Realm[]>([]);
  const [rows, setRows] = useState<SpreadRow[]>([]);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRealms(region)
      .then((next) => {
        if (!cancelled) setRealms(next);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load realms");
      });
    return () => {
      cancelled = true;
    };
  }, [region]);

  useEffect(() => {
    if (realms.length === 0) return;
    if (homeRealmId == null || !realms.some((realm) => realm.id === homeRealmId)) {
      const preferred = realms.find((realm) => realm.name.includes("Tarren Mill")) ?? realms.find((realm) => realm.name === "Silvermoon") ?? realms[0];
      setHomeRealmId(preferred.id);
      return;
    }
    const known = new Set(realms.map((realm) => realm.id));
    const valid = watchRealmIds.filter((realmId) => known.has(realmId) && realmId !== homeRealmId);
    if (valid.length === watchRealmIds.length) return;
    setWatchRealmIds(valid.length > 0 ? valid : realms.filter((realm) => realm.id !== homeRealmId).slice(0, 2).map((realm) => realm.id));
  }, [homeRealmId, realms, setHomeRealmId, setWatchRealmIds, watchRealmIds]);

  useEffect(() => {
    const remoteRealmIds = watchRealmIds.filter((realmId) => realmId !== homeRealmId);
    if (homeRealmId == null || remoteRealmIds.length === 0) return;
    let cancelled = false;
    const itemIds = arbitrageWatchlist.map((item) => item.itemId);

    Promise.all([
      getPrices({ region, itemIds, connectedRealmId: homeRealmId }),
      ...remoteRealmIds.map(async (realmId) => ({
        realmId,
        result: await getPrices({ region, itemIds, connectedRealmId: realmId }),
      })),
    ])
      .then(([home, ...remotes]) => {
        if (cancelled) return;
        const homeQuotes = new Map(home.quotes.map((quote) => [quote.itemId, quote]));
        const ranked: SpreadRow[] = [];
        for (const item of arbitrageWatchlist) {
          const homeQuote = homeQuotes.get(item.itemId);
          const homePrice = homeQuote?.marketValue;
          if (homePrice == null) continue;
          let best: SpreadRow | null = null;
          for (const remote of remotes) {
            const remoteQuote = remote.result.quotes.find((quote) => quote.itemId === item.itemId);
            const remotePrice = remoteQuote?.marketValue;
            if (remotePrice == null) continue;
            const saleRate = homeQuote?.saleRate ?? remoteQuote?.saleRate ?? null;
            const soldPerDay = homeQuote?.soldPerDay ?? remoteQuote?.soldPerDay ?? null;
            const spread = arbitrageSpread(homePrice, remotePrice);
            const expected = expectedArbitrage(homePrice, remotePrice, saleRate);
            const row: SpreadRow = {
              itemId: item.itemId,
              name: item.name,
              homePrice,
              remotePrice,
              remoteRealm: realms.find((realm) => realm.id === remote.realmId)?.name ?? String(remote.realmId),
              spread,
              saleRate,
              soldPerDay,
              expected,
            };
            const candidateWins =
              best == null ||
              (expected ?? Number.NEGATIVE_INFINITY) > (best.expected ?? Number.NEGATIVE_INFINITY) ||
              (expected === best.expected && spread > best.spread);
            if (candidateWins) best = row;
          }
          if (best) ranked.push(best);
        }
        setRows(rankSpreads(ranked));
        setStale(home.stale || remotes.some((remote) => remote.result.stale));
        setAsOf(earlierAsOf([home, ...remotes.map((remote) => remote.result)].flatMap((result) => result.quotes.map((quote) => quote.updatedAt))));
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not compare realms");
      });

    return () => {
      cancelled = true;
    };
  }, [homeRealmId, realms, region, watchRealmIds]);

  return (
    <section className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold">Cross-realm arbitrage</h1>
        <p className="text-muted-foreground text-xs">
          Expected gold is the remote price after the auction house cut, multiplied by the regional sale rate, minus what you pay at home. A negative number loses gold if the item sells only as often as that rate. Home realm: {realms.find((realm) => realm.id === homeRealmId)?.name ?? homeNameFallback(homeRealmId)}. <PriceStamp asOf={asOf} stale={stale} />
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          Home
          <RealmPicker realms={realms} value={homeRealmId} onChange={setHomeRealmId} />
        </label>
        <div className="flex flex-wrap gap-1">
          {realms
            .filter((realm) => realm.id !== homeRealmId)
            .map((realm) => {
              const active = watchRealmIds.includes(realm.id);
              return (
                <button key={realm.id} type="button" onClick={() => toggleWatchRealm(realm.id)}>
                  <Badge variant={active ? "default" : "outline"}>{realm.name}</Badge>
                </button>
              );
            })}
        </div>
      </div>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
      <div className="border-border overflow-hidden rounded-md border">
        <SortableTable
          rows={rows}
          initialKey="expected"
          initialDirection="desc"
          rowKey={(row) => String(row.itemId)}
          columns={[
            { key: "name", header: "Item", sortValue: (row) => row.name, cell: (row) => row.name },
            { key: "remote", header: "Best remote", sortValue: (row) => row.remoteRealm, cell: (row) => row.remoteRealm },
            { key: "home", header: "Home", align: "right", sortValue: (row) => row.homePrice, cell: (row) => formatCopper(row.homePrice) },
            { key: "ask", header: "Remote", align: "right", sortValue: (row) => row.remotePrice, cell: (row) => formatCopper(row.remotePrice) },
            {
              key: "sold",
              header: "Sold / day",
              align: "right",
              sortValue: (row) => row.soldPerDay ?? -1,
              cell: (row) => (row.soldPerDay == null ? "n/a" : row.soldPerDay >= 10 ? `${Math.round(row.soldPerDay)}` : `${Math.round(row.soldPerDay * 10) / 10}`),
            },
            {
              key: "sale",
              header: "Sale rate",
              align: "right",
              sortValue: (row) => row.saleRate ?? -1,
              cell: (row) => (row.saleRate == null ? "n/a" : formatPercent(row.saleRate)),
            },
            {
              key: "spread",
              header: "If it sells",
              align: "right",
              sortValue: (row) => row.spread,
              cell: (row) => <span className={row.spread < 0 ? "text-red-400" : "text-emerald-400"}>{formatCopper(row.spread)}</span>,
            },
            {
              key: "expected",
              header: "Expected",
              align: "right",
              sortValue: (row) => row.expected ?? Number.NEGATIVE_INFINITY,
              cell: (row) => (
                <span className={row.expected == null ? "text-muted-foreground" : row.expected < 0 ? "text-red-400" : "text-emerald-400"}>
                  {formatCopper(row.expected)}
                </span>
              ),
            },
          ]}
        />
      </div>
    </section>
  );
}

function homeNameFallback(homeRealmId: number | null): string {
  return homeRealmId == null ? "not set" : String(homeRealmId);
}
