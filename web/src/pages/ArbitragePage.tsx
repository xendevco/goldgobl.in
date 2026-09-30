import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { RealmPicker } from "@/components/RealmPicker";
import { SortableTable } from "@/components/SortableTable";
import { arbitrageWatchlist } from "@/data/watchlist";
import { getPrices, getRealms } from "@/lib/api";
import { arbitrageSpread, rankSpreads, type SpreadRow } from "@/lib/arbitrage";
import { formatCopper } from "@/lib/format";
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
    if (homeRealmId == null) setHomeRealmId(realms[0].id);
    if (watchRealmIds.length === 0) setWatchRealmIds(realms.slice(1, 3).map((realm) => realm.id));
  }, [homeRealmId, realms, setHomeRealmId, setWatchRealmIds, watchRealmIds.length]);

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
        const homePrices = new Map(home.quotes.map((quote) => [quote.itemId, quote.marketValue]));
        const ranked: SpreadRow[] = [];
        for (const item of arbitrageWatchlist) {
          const homePrice = homePrices.get(item.itemId);
          if (homePrice == null) continue;
          let best: SpreadRow | null = null;
          for (const remote of remotes) {
            const remotePrice = remote.result.quotes.find((quote) => quote.itemId === item.itemId)?.marketValue;
            if (remotePrice == null) continue;
            const spread = arbitrageSpread(homePrice, remotePrice);
            const row: SpreadRow = {
              itemId: item.itemId,
              name: item.name,
              homePrice,
              remotePrice,
              remoteRealm: realms.find((realm) => realm.id === remote.realmId)?.name ?? String(remote.realmId),
              spread,
            };
            if (!best || row.spread > best.spread) best = row;
          }
          if (best) ranked.push(best);
        }
        setRows(rankSpreads(ranked));
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
          Spread is the remote price minus the home price minus the auction house cut. Home realm: {realms.find((realm) => realm.id === homeRealmId)?.name ?? homeNameFallback(homeRealmId)}.
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
          initialKey="spread"
          initialDirection="desc"
          rowKey={(row) => String(row.itemId)}
          columns={[
            { key: "name", header: "Item", sortValue: (row) => row.name, cell: (row) => row.name },
            { key: "remote", header: "Best remote", sortValue: (row) => row.remoteRealm, cell: (row) => row.remoteRealm },
            { key: "home", header: "Home", align: "right", sortValue: (row) => row.homePrice, cell: (row) => formatCopper(row.homePrice) },
            { key: "ask", header: "Remote", align: "right", sortValue: (row) => row.remotePrice, cell: (row) => formatCopper(row.remotePrice) },
            {
              key: "spread",
              header: "Spread",
              align: "right",
              sortValue: (row) => row.spread,
              cell: (row) => <span className={row.spread < 0 ? "text-red-400" : "text-emerald-400"}>{formatCopper(row.spread)}</span>,
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
