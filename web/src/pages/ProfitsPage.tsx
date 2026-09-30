import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SortableTable } from "@/components/SortableTable";
import { decorItems } from "@/data/decor";
import { usePrices } from "@/hooks/usePrices";
import { formatCopper } from "@/lib/format";
import { expectedNet, reagentCost } from "@/lib/yield";
import { useRoster } from "@/stores/roster";
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
  const itemIds = [
    ...new Set(decorItems.flatMap((item) => [item.itemId, ...item.reagents.map((reagent) => reagent.itemId)])),
  ];
  const prices = usePrices(itemIds);

  const rows = decorItems.map((item) => {
    const priceOf = (id: number) => prices.quotes[id]?.marketValue ?? null;
    const cost = reagentCost(
      item.reagents,
      new Map(item.reagents.map((reagent) => [reagent.itemId, priceOf(reagent.itemId)])),
    );
    const sell = priceOf(item.itemId);
    const saleRate = prices.quotes[item.itemId]?.saleRate ?? 0;
    const net =
      cost == null || sell == null
        ? null
        : expectedNet({
            reagentCost: cost,
            sellPrice: sell,
            saleRate,
            multicraftChance: settings.multicraftChance,
            resourcefulnessChance: settings.resourcefulnessChance,
            ingenuityChance: settings.ingenuityChance,
          });
    return { item, cost, sell, saleRate, net };
  });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Crafting profitability</h1>
          <p className="text-muted-foreground text-xs">Expected net uses Multicraft, Resourcefulness, and Ingenuity on live reagent prices.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {prices.stale ? <Badge variant="outline">Stale cache</Badge> : null}
          {prices.loading ? <span className="text-muted-foreground text-xs">Loading prices</span> : null}
          <Button size="sm" variant="outline" onClick={() => void prices.refresh()}>
            Refresh
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        {percentField("Multicraft %", settings.multicraftChance, (value) => setCraftStat("multicraftChance", value))}
        {percentField("Resourcefulness %", settings.resourcefulnessChance, (value) => setCraftStat("resourcefulnessChance", value))}
        {percentField("Ingenuity %", settings.ingenuityChance, (value) => setCraftStat("ingenuityChance", value))}
      </div>
      {prices.error ? <p className="text-destructive text-xs">{prices.error}</p> : null}
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
              cell: (row) => formatCopper(row.cost),
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
              sortValue: (row) => row.saleRate,
              cell: (row) => `${Math.round(row.saleRate * 100)}%`,
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
