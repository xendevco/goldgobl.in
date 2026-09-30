import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PriceStamp } from "@/components/PriceStamp";
import { RealmPicker } from "@/components/RealmPicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SortableTable } from "@/components/SortableTable";
import { decorExpansions, decorItems, decorReagentIds, isLumberReagent } from "@/data/decor";
import { usePrices } from "@/hooks/usePrices";
import { getRealms } from "@/lib/api";
import { craftReagentIds, rosterCrafts } from "@/lib/crafts";
import { earlierAsOf, formatCopper, formatPercent } from "@/lib/format";
import { cheapestSlotCost, expectedNet, expectedReagentCost, expectedRevenue, partialReagentCost } from "@/lib/yield";
import { useRoster } from "@/stores/roster";
import type { Realm } from "@/types/api";

function percentField(label: string, value: number, onChange: (value: number) => void) {
  return (
    <label className="text-muted-foreground flex items-center gap-2 text-xs">
      {label}
      <Input
        aria-label={label}
        className="h-8 w-16"
        type="number"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
      />
    </label>
  );
}

function soldLabel(soldPerDay: number | null) {
  if (soldPerDay == null) return "n/a";
  return soldPerDay >= 10 ? `${Math.round(soldPerDay)}` : `${Math.round(soldPerDay * 10) / 10}`;
}

export function ProfitsPage() {
  const characters = useRoster((state) => state.characters);
  const settings = useRoster((state) => state.settings);
  const setCraftStat = useRoster((state) => state.setCraftStat);
  const setHomeRealmId = useRoster((state) => state.setHomeRealmId);
  const [realms, setRealms] = useState<Realm[]>([]);
  const [lumberGold, setLumberGold] = useState(0);
  const [catalogue, setCatalogue] = useState("decor");
  const [view, setView] = useState("profit");
  const homeRealm = realms.find((realm) => realm.id === settings.homeRealmId);
  const { crafts, unscanned } = useMemo(() => rosterCrafts(characters), [characters]);
  const showingCrafts = catalogue === "crafts";
  const reagentPrices = usePrices(showingCrafts ? craftReagentIds(crafts) : decorReagentIds());
  const decorMarkets = usePrices(
    showingCrafts || !homeRealm ? [] : decorItems.map((item) => item.itemId),
    homeRealm?.id,
  );
  const craftCommodities = usePrices(showingCrafts ? crafts.map((craft) => craft.itemId) : []);
  const [realmFallbackIds, setRealmFallbackIds] = useState<number[]>([]);

  useEffect(() => {
    if (!showingCrafts || !craftCommodities.settled || craftCommodities.loading) return;
    setRealmFallbackIds(crafts.map((craft) => craft.itemId).filter((itemId) => craftCommodities.quotes[itemId]?.marketValue == null));
  }, [crafts, craftCommodities.loading, craftCommodities.quotes, craftCommodities.settled, showingCrafts]);

  const craftRealms = usePrices(showingCrafts ? realmFallbackIds : [], homeRealm?.id);

  useEffect(() => {
    let cancelled = false;
    getRealms(settings.region)
      .then((next) => {
        if (!cancelled) setRealms(next);
      })
      .catch(() => {
        if (!cancelled) setRealms([]);
      });
    return () => {
      cancelled = true;
    };
  }, [settings.region]);

  useEffect(() => {
    if (realms.length === 0) return;
    if (settings.homeRealmId != null && realms.some((realm) => realm.id === settings.homeRealmId)) return;
    const preferred =
      realms.find((realm) => realm.name.includes("Tarren Mill")) ??
      realms.find((realm) => realm.name === "Silvermoon") ??
      realms[0];
    setHomeRealmId(preferred.id);
  }, [realms, setHomeRealmId, settings.homeRealmId]);

  const decorRows = decorItems.map((item) => {
    const bought = item.reagents.filter((reagent) => !isLumberReagent(reagent));
    const lumberQty = item.reagents.filter(isLumberReagent).reduce((total, reagent) => total + reagent.quantity, 0);
    const materials = partialReagentCost(
      bought,
      new Map(bought.map((reagent) => [reagent.itemId, reagentPrices.quotes[reagent.itemId]?.marketValue ?? null])),
    );
    const quote = decorMarkets.quotes[item.itemId];
    const sell = quote?.marketValue ?? null;
    const saleRate = quote?.saleRate ?? null;
    const soldPerDay = quote?.soldPerDay ?? null;
    const yieldInput = {
      sellPrice: sell ?? 0,
      saleRate: saleRate ?? 0,
      multicraftChance: settings.multicraftChance,
      resourcefulnessChance: settings.resourcefulnessChance,
      ingenuityChance: settings.ingenuityChance,
    };
    const lumberCost = lumberQty * lumberGold * 10000;
    const net =
      sell == null || saleRate == null
        ? null
        : expectedNet({ ...yieldInput, reagentCost: materials.total + lumberCost });
    const perLog =
      sell == null || saleRate == null || lumberQty === 0
        ? null
        : (expectedRevenue(yieldInput) - expectedReagentCost({ reagentCost: materials.total, ...yieldInput })) / lumberQty;
    return { item, cost: materials.total + lumberCost, missing: materials.missing, sell, saleRate, soldPerDay, net, perLog, lumberQty };
  });
  const visibleDecor = decorRows.filter((row) => view === "all" || view === "profit" || view === "sellers" || row.item.expansion === view);
  const rankedDecor =
    view === "sellers"
      ? [...visibleDecor].sort((left, right) => (right.soldPerDay ?? -1) - (left.soldPerDay ?? -1)).slice(0, 25)
      : view === "profit"
        ? [...visibleDecor].sort((left, right) => (right.perLog ?? Number.NEGATIVE_INFINITY) - (left.perLog ?? Number.NEGATIVE_INFINITY)).slice(0, 25)
        : visibleDecor;

  const craftRows = crafts.map((craft) => {
    const materials = cheapestSlotCost(
      craft.reagents,
      new Map(
        craft.reagents.flatMap((slot) => slot.options.map((option) => [option.itemId, reagentPrices.quotes[option.itemId]?.marketValue ?? null] as const)),
      ),
    );
    const quote = craftCommodities.quotes[craft.itemId]?.marketValue != null ? craftCommodities.quotes[craft.itemId] : craftRealms.quotes[craft.itemId];
    const unit = quote?.marketValue ?? null;
    const saleRate = quote?.saleRate ?? craftCommodities.quotes[craft.itemId]?.saleRate ?? null;
    const soldPerDay = quote?.soldPerDay ?? craftCommodities.quotes[craft.itemId]?.soldPerDay ?? null;
    const yieldInput = {
      sellPrice: (unit ?? 0) * craft.quantity,
      saleRate: saleRate ?? 0,
      multicraftChance: settings.multicraftChance,
      resourcefulnessChance: settings.resourcefulnessChance,
      ingenuityChance: settings.ingenuityChance,
    };
    const net = unit == null || saleRate == null ? null : expectedNet({ ...yieldInput, reagentCost: materials.total });
    return { craft, cost: materials.total, missing: materials.missing, sell: unit, saleRate, soldPerDay, net };
  });
  const professions = [...new Set(crafts.map((craft) => craft.profession))].sort((left, right) => left.localeCompare(right, "en-GB"));
  const visibleCrafts = craftRows.filter((row) => view === "all" || view === "profit" || view === "sellers" || row.craft.profession === view);
  const rankedCrafts =
    view === "sellers"
      ? [...visibleCrafts].sort((left, right) => (right.soldPerDay ?? -1) - (left.soldPerDay ?? -1)).slice(0, 25)
      : view === "profit"
        ? [...visibleCrafts].sort((left, right) => (right.net ?? Number.NEGATIVE_INFINITY) - (left.net ?? Number.NEGATIVE_INFINITY)).slice(0, 25)
        : visibleCrafts;

  const loading = reagentPrices.loading || decorMarkets.loading || craftCommodities.loading || craftRealms.loading;
  const error = reagentPrices.error ?? decorMarkets.error ?? craftCommodities.error ?? craftRealms.error;
  const stale = showingCrafts
    ? reagentPrices.stale || craftCommodities.stale || craftRealms.stale
    : reagentPrices.stale || decorMarkets.stale;
  const asOf = earlierAsOf(
    showingCrafts
      ? [reagentPrices.asOf, craftCommodities.asOf, craftRealms.asOf]
      : [reagentPrices.asOf, decorMarkets.asOf],
  );

  function refresh() {
    void reagentPrices.refresh();
    void decorMarkets.refresh();
    void craftCommodities.refresh();
    void craftRealms.refresh();
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Crafting profitability</h1>
          <p className="text-muted-foreground text-xs">
            {showingCrafts
              ? view === "sellers"
                ? "The 25 roster crafts that sell most often."
                : view === "profit"
                  ? "The 25 roster crafts with the best expected gold."
                  : `${rankedCrafts.length} crafts${view === "all" ? " your roster can make" : ` from ${view}`}.`
              : view === "sellers"
                ? "The 25 decor crafts that sell most often, using TradeSkillMaster's daily sales."
                : view === "profit"
                  ? "The 25 decor crafts with the best expected gold per log."
                  : `${rankedDecor.length} crafts${view === "all" ? " across every expansion" : ` from ${view}`}.`}{" "}
            {showingCrafts
              ? "Expected net is one craft after the auction house cut, the sale rate, and the cheapest priced material in each required slot."
              : `Market is the cheapest listing on ${homeRealm?.name ?? "the home realm"}. Per log is the expected gold from one piece of lumber after bought reagents and the sale rate.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={catalogue}
            onValueChange={(next) => {
              setCatalogue(next);
              setView("profit");
            }}
          >
            <SelectTrigger size="sm" aria-label="Catalogue" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="decor">Decor</SelectItem>
              <SelectItem value="crafts">Your crafts</SelectItem>
            </SelectContent>
          </Select>
          <Select value={view} onValueChange={setView}>
            <SelectTrigger size="sm" aria-label="Craft list" className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="profit">Best expected profit</SelectItem>
              <SelectItem value="sellers">Best sellers</SelectItem>
              <SelectItem value="all">{showingCrafts ? "All your crafts" : "All expansions"}</SelectItem>
              {showingCrafts
                ? professions.map((profession) => (
                    <SelectItem key={profession} value={profession}>
                      {profession}
                    </SelectItem>
                  ))
                : decorExpansions().map((expansion) => (
                    <SelectItem key={expansion} value={expansion}>
                      {expansion}
                    </SelectItem>
                  ))}
            </SelectContent>
          </Select>
          <RealmPicker realms={realms} value={settings.homeRealmId} onChange={setHomeRealmId} />
          <PriceStamp asOf={asOf} stale={stale} />
          {stale ? <Badge variant="outline">Stale cache</Badge> : null}
          {loading ? <span className="text-muted-foreground text-xs">Loading prices</span> : null}
          <Button size="sm" variant="outline" onClick={refresh}>
            Refresh
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        {percentField("Multicraft %", settings.multicraftChance, (value) => setCraftStat("multicraftChance", value))}
        {percentField("Resourcefulness %", settings.resourcefulnessChance, (value) => setCraftStat("resourcefulnessChance", value))}
        {percentField("Ingenuity %", settings.ingenuityChance, (value) => setCraftStat("ingenuityChance", value))}
        {showingCrafts ? null : (
          <label className="text-muted-foreground flex items-center gap-2 text-xs">
            Lumber value (g)
            <Input
              aria-label="Lumber value (g)"
              className="h-8 w-20"
              type="number"
              min={0}
              step="0.1"
              value={lumberGold}
              onChange={(event) => setLumberGold(Number(event.target.value))}
            />
          </label>
        )}
      </div>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
      {showingCrafts && unscanned > 0 ? (
        <p className="text-muted-foreground text-xs">
          {unscanned} known {unscanned === 1 ? "recipe has" : "recipes have"} no material list. Open each profession in game, run /gg, and paste the export again.
        </p>
      ) : null}
      {showingCrafts && crafts.length === 0 && unscanned === 0 ? (
        <p className="text-muted-foreground text-sm">
          {characters.length === 0
            ? "Import a roster to rank the crafts those characters know. Decor stays available above."
            : "Open each profession in game so the export includes the crafted item and its materials, then paste it here again."}
        </p>
      ) : null}
      {showingCrafts && crafts.length > 0 ? (
        <div className="border-border overflow-hidden rounded-md border">
          <SortableTable
            key={view}
            rows={rankedCrafts}
            initialKey={view === "sellers" ? "sold" : "net"}
            initialDirection="desc"
            rowKey={(row) => String(row.craft.recipeId)}
            columns={[
              {
                key: "name",
                header: "Craft",
                sortValue: (row) => row.craft.name,
                cell: (row) => (row.craft.quantity > 1 ? `${row.craft.name} (${row.craft.quantity})` : row.craft.name),
              },
              { key: "profession", header: "Profession", sortValue: (row) => row.craft.profession, cell: (row) => row.craft.profession },
              { key: "who", header: "Who", sortValue: (row) => row.craft.crafters.join(", "), cell: (row) => row.craft.crafters.join(", ") },
              {
                key: "cost",
                header: "Expected cost",
                align: "right",
                sortValue: (row) => row.cost,
                cell: (row) => (
                  <span>
                    {formatCopper(row.cost)}
                    {row.missing.length > 0 ? <span className="text-muted-foreground block text-[10px]">excludes {row.missing.join(", ")}</span> : null}
                  </span>
                ),
              },
              { key: "sell", header: "Market", align: "right", sortValue: (row) => row.sell ?? -1, cell: (row) => formatCopper(row.sell) },
              { key: "sold", header: "Sold / day", align: "right", sortValue: (row) => row.soldPerDay ?? -1, cell: (row) => soldLabel(row.soldPerDay) },
              {
                key: "sale",
                header: "Sale rate",
                align: "right",
                sortValue: (row) => row.saleRate ?? -1,
                cell: (row) => (row.saleRate == null ? "n/a" : formatPercent(row.saleRate)),
              },
              {
                key: "net",
                header: "Expected net",
                align: "right",
                sortValue: (row) => row.net ?? Number.NEGATIVE_INFINITY,
                cell: (row) => <Net net={row.net} />,
              },
            ]}
          />
        </div>
      ) : null}
      {showingCrafts ? null : (
        <div className="border-border overflow-hidden rounded-md border">
          <SortableTable
            key={view}
            rows={rankedDecor}
            initialKey={view === "sellers" ? "sold" : "perLog"}
            initialDirection="desc"
            rowKey={(row) => String(row.item.itemId)}
            columns={[
              { key: "name", header: "Craft", sortValue: (row) => row.item.name, cell: (row) => row.item.name },
              { key: "expansion", header: "Expansion", sortValue: (row) => row.item.expansion, cell: (row) => row.item.expansion },
              { key: "profession", header: "Profession", sortValue: (row) => row.item.profession, cell: (row) => row.item.profession },
              {
                key: "cost",
                header: "Expected cost",
                align: "right",
                sortValue: (row) => row.cost ?? -1,
                cell: (row) => (
                  <span>
                    {formatCopper(row.cost)}
                    {row.missing.length > 0 ? <span className="text-muted-foreground block text-[10px]">excludes {row.missing.join(", ")}</span> : null}
                  </span>
                ),
              },
              { key: "sell", header: "Market", align: "right", sortValue: (row) => row.sell ?? -1, cell: (row) => formatCopper(row.sell) },
              { key: "sold", header: "Sold / day", align: "right", sortValue: (row) => row.soldPerDay ?? -1, cell: (row) => soldLabel(row.soldPerDay) },
              {
                key: "sale",
                header: "Sale rate",
                align: "right",
                sortValue: (row) => row.saleRate ?? -1,
                cell: (row) => (row.saleRate == null ? "n/a" : formatPercent(row.saleRate)),
              },
              {
                key: "net",
                header: "Expected net",
                align: "right",
                sortValue: (row) => row.net ?? Number.NEGATIVE_INFINITY,
                cell: (row) => <Net net={row.net} />,
              },
              {
                key: "perLog",
                header: "Per log",
                align: "right",
                sortValue: (row) => row.perLog ?? Number.NEGATIVE_INFINITY,
                cell: (row) => <Net net={row.perLog} />,
              },
            ]}
          />
        </div>
      )}
    </section>
  );
}

function Net({ net }: { net: number | null }) {
  return <span className={net != null && net < 0 ? "text-red-400" : "text-emerald-400"}>{formatCopper(net)}</span>;
}
