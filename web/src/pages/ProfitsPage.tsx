import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SortableTable } from "@/components/SortableTable";
import { decorItems, decorReagentIds } from "@/data/decor";
import { usePrices } from "@/hooks/usePrices";
import { getRealms } from "@/lib/api";
import { formatCopper } from "@/lib/format";
import { expectedNet, partialReagentCost } from "@/lib/yield";
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
    const materials = partialReagentCost(
      item.reagents,
      new Map(item.reagents.map((reagent) => [reagent.itemId, reagentPrices.quotes[reagent.itemId]?.marketValue ?? null])),
    );
    const sell = marketPrices.quotes[item.itemId]?.marketValue ?? null;
    const saleRate = marketPrices.quotes[item.itemId]?.saleRate ?? null;
    const net =
      sell == null
        ? null
        : expectedNet({
            reagentCost: materials.total,
            sellPrice: sell,
            saleRate: saleRate ?? 1,
            multicraftChance: settings.multicraftChance,
            resourcefulnessChance: settings.resourcefulnessChance,
            ingenuityChance: settings.ingenuityChance,
          });
    return { item, cost: materials.total, missing: materials.missing, sell, saleRate, net };
  });
  const loading = reagentPrices.loading || marketPrices.loading;
  const error = reagentPrices.error ?? marketPrices.error;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Crafting profitability</h1>
          <p className="text-muted-foreground text-xs">
            Market is the cheapest listing on {homeRealm?.name ?? "the home realm"}. Thalassian Lumber is warbound, so it is left out of the cost. Expected net assumes a sale until TradeSkillMaster provides a sale rate.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={settings.homeRealmId ? String(settings.homeRealmId) : undefined}
            onValueChange={(value) => setHomeRealmId(Number(value))}
          >
            <SelectTrigger size="sm" aria-label="Home realm" className="w-44">
              <SelectValue placeholder="Choose realm" />
            </SelectTrigger>
            <SelectContent>
              {realms.map((realm) => (
                <SelectItem key={realm.id} value={String(realm.id)}>
                  {realm.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
      </div>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
      <div className="border-border overflow-hidden rounded-md border">
        <SortableTable
          rows={rows}
          initialKey="net"
          initialDirection="desc"
          rowKey={(row) => String(row.item.itemId)}
          columns={[
            { key: "name", header: "Craft", sortValue: (row) => row.item.name, cell: (row) => row.item.name },
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
              key: "sale",
              header: "Sale rate",
              align: "right",
              sortValue: (row) => row.saleRate ?? -1,
              cell: (row) => (row.saleRate == null ? "n/a" : `${Math.round(row.saleRate * 100)}%`),
            },
            {
              key: "net",
              header: "Expected net",
              align: "right",
              sortValue: (row) => row.net ?? -1,
              cell: (row) => <Net net={row.net} />,
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
