import { useCallback, useEffect, useState } from "react";
import { getPrices } from "@/lib/api";
import { useRoster } from "@/stores/roster";
import type { PriceQuote } from "@/types/api";

export function usePrices(itemIds: number[], connectedRealmId?: number | null) {
  const region = useRoster((state) => state.settings.region);
  const idsKey = [...new Set(itemIds)].sort((left, right) => left - right).join(",");
  const [quotes, setQuotes] = useState<Record<number, PriceQuote>>({});
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const ids = idsKey ? idsKey.split(",").map(Number) : [];
    if (ids.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const next: Record<number, PriceQuote> = {};
      let stale = false;
      for (let index = 0; index < ids.length; index += 150) {
        const result = await getPrices({ region, itemIds: ids.slice(index, index + 150), connectedRealmId });
        for (const quote of result.quotes) next[quote.itemId] = quote;
        stale = stale || result.stale;
      }
      setQuotes(next);
      setStale(stale);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Price request failed");
    } finally {
      setLoading(false);
    }
  }, [connectedRealmId, idsKey, region]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { quotes, stale, loading, error, refresh };
}
