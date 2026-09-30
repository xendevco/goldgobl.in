import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SortableTable } from "@/components/SortableTable";
import { decorItems, decorReagentIds } from "@/data/decor";
import { usePrices } from "@/hooks/usePrices";
import { formatCopper } from "@/lib/format";
import { reagentCost } from "@/lib/yield";

const reagentIds = decorReagentIds();

export function DecorPage() {
  const prices = usePrices(reagentIds);
  const rows = decorItems.map((item) => ({
    item,
    cost: reagentCost(
      item.reagents,
      new Map(item.reagents.map((reagent) => [reagent.itemId, prices.quotes[reagent.itemId]?.marketValue ?? null])),
    ),
  }));

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Midnight decor hub</h1>
          <p className="text-muted-foreground text-xs">
            Pricing {reagentIds.length} reagents. Output items stay off this request so the housing list stays small.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {prices.stale ? <Badge variant="outline">Stale cache</Badge> : null}
          <Button size="sm" variant="outline" onClick={() => void prices.refresh()}>
            Refresh
          </Button>
        </div>
      </div>
      {prices.error ? <p className="text-destructive text-xs">{prices.error}</p> : null}
      <div className="border-border overflow-hidden rounded-md border">
        <SortableTable
          caption={`Reagent ids ${reagentIds.join(", ")}`}
          rows={rows}
          rowKey={(row) => String(row.item.decorId)}
          columns={[
            { key: "name", header: "Decor", sortValue: (row) => row.item.name, cell: (row) => row.item.name },
            { key: "profession", header: "Profession", sortValue: (row) => row.item.profession, cell: (row) => row.item.profession },
            {
              key: "reagents",
              header: "Materials",
              sortValue: (row) => row.item.reagents.length,
              cell: (row) => row.item.reagents.map((reagent) => `${reagent.quantity} ${reagent.name}`).join(", "),
            },
            {
              key: "cost",
              header: "Reagent cost",
              align: "right",
              sortValue: (row) => row.cost ?? -1,
              cell: (row) => formatCopper(row.cost),
            },
          ]}
        />
      </div>
    </section>
  );
}
