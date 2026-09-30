import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RealmPicker } from "@/components/RealmPicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SortableTable } from "@/components/SortableTable";
import { decorExpansions, decorItems, decorReagentIds, isLumberReagent } from "@/data/decor";
import { usePrices } from "@/hooks/usePrices";
import { getRealms } from "@/lib/api";
import { formatCopper, formatPercent } from "@/lib/format";
import { expectedNet, expectedReagentCost, expectedRevenue, partialReagentCost } from "@/lib/yield";
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

export function ProfitsPage() {
  const settings = useRoster((state) => state.settings);
  const setCraftStat = useRoster((state) => state.setCraftStat);
  const setHomeRealmId = useRoster((state) => state.setHomeRealmId);
  const [realms, setRealms] = useState<Realm[]>([]);
  const [lumberGold, setLumberGold] = useState(0);
  const [view, setView] = useState("profit");
  const homeRealm = realms.find((realm) => realm.id === settings.homeRealmId);
  const reagentPrices = usePrices(decorReagentIds());
  const marketPrices = usePrices(
    homeRealm ? decorItems.map((item) => item.itemId) : [],
    homeRealm?.id,
  );

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

  const rows = decorItems.map((item) => {
    const bought = item.reagents.filter((reagent) => !isLumberReagent(reagent));
    const lumberQty = item.reagents.filter(isLumberReagent).reduce((total, reagent) => total + reagent.quantity, 0);
    const materials = partialReagentCost(
      bought,
      new Map(bought.map((reagent) => [reagent.itemId, reagentPrices.quotes[reagent.itemId]?.marketValue ?? null])),
    );
    const sell = marketPrices.quotes[item.itemId]?.marketValue ?? null;
    const saleRate = marketPrices.quotes[item.itemId]?.saleRate ?? null;
    const soldPerDay = marketPrices.quotes[item.itemId]?.soldPerDay ?? null;
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
  const visibleRows = rows.filter((row) => view === "all" || view === "profit" || view === "sellers" || row.item.expansion === view);
  const rankedRows =
    view === "sellers"
      ? [...visibleRows].sort((left, right) => (right.soldPerDay ?? -1) - (left.soldPerDay ?? -1)).slice(0, 25)
      : view === "profit"
        ? [...visibleRows].sort((left, right) => (right.perLog ?? Number.NEGATIVE_INFINITY) - (left.perLog ?? Number.NEGATIVE_INFINITY)).slice(0, 25)
        : visibleRows;
  const loading = reagentPrices.loading || marketPrices.loading;
  const error = reagentPrices.error ?? marketPrices.error;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Crafting profitability</h1>
          <p className="text-muted-foreground text-xs">
            {view === "sellers"
              ? "The 25 crafts that sell most often, using TradeSkillMaster's daily sales."
              : view === "profit"
                ? "The 25 crafts with the best expected gold per log."
                : `${rankedRows.length} crafts${view === "all" ? " across every expansion" : ` from ${view}`}.`}{" "}
            Market is the cheapest listing on {homeRealm?.name ?? "the home realm"}. Per log is the expected gold from one piece of lumber after bought reagents and the sale rate.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={view} onValueChange={setView}>
            <SelectTrigger size="sm" aria-label="Decor list" className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="profit">Best expected profit</SelectItem>
              <SelectItem value="sellers">Best sellers</SelectItem>
              <SelectItem value="all">All expansions</SelectItem>
              {decorExpansions().map((expansion) => (
                <SelectItem key={expansion} value={expansion}>
                  {expansion}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <RealmPicker realms={realms} value={settings.homeRealmId} onChange={setHomeRealmId} />
          {reagentPrices.stale || marketPrices.stale ? <Badge variant="outline">Stale cache</Badge> : null}
          {loading ? <span className="text-muted-foreground text-xs">Loading prices</span> : null}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void reagentPrices.refresh();
              void marketPrices.refresh();
            }}
          >
            Refresh
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        {percentField("Multicraft %", settings.multicraftChance, (value) => setCraftStat("multicraftChance", value))}
        {percentField("Resourcefulness %", settings.resourcefulnessChance, (value) => setCraftStat("resourcefulnessChance", value))}
        {percentField("Ingenuity %", settings.ingenuityChance, (value) => setCraftStat("ingenuityChance", value))}
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
      </div>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
      <div className="border-border overflow-hidden rounded-md border">
        <SortableTable
          key={view}
          rows={rankedRows}
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
            {
              key: "sell",
              header: "Market",
              align: "right",
              sortValue: (row) => row.sell ?? -1,
              cell: (row) => formatCopper(row.sell),
            },
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
    </section>
  );
}

function Net({ net }: { net: number | null }) {
  return <span className={net != null && net < 0 ? "text-red-400" : "text-emerald-400"}>{formatCopper(net)}</span>;
}
