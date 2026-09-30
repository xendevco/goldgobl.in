import { useState } from "react";
import { PriceStamp } from "@/components/PriceStamp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SortableTable } from "@/components/SortableTable";
import { decorExpansions, decorItems, isLumberReagent } from "@/data/decor";
import { usePrices } from "@/hooks/usePrices";
import { formatCopper } from "@/lib/format";
import { partialReagentCost } from "@/lib/yield";

export function DecorPage() {
  const [expansion, setExpansion] = useState("Midnight");
  const shown = decorItems.filter((item) => expansion === "all" || item.expansion === expansion);
  const reagentIds = [...new Set(shown.flatMap((item) => item.reagents.map((reagent) => reagent.itemId)))];
  const prices = usePrices(reagentIds);
  const rows = shown.map((item) => {
    const bought = item.reagents.filter((reagent) => !isLumberReagent(reagent));
    return {
      item,
      cost: partialReagentCost(
        bought,
        new Map(bought.map((reagent) => [reagent.itemId, prices.quotes[reagent.itemId]?.marketValue ?? null])),
      ),
    };
  });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Decor hub</h1>
          <p className="text-muted-foreground text-xs">
            {shown.length} crafts{expansion === "all" ? " across every expansion" : ` from ${expansion}`}. Lumber is warbound and is left out of the cost.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={expansion} onValueChange={setExpansion}>
            <SelectTrigger size="sm" aria-label="Expansion" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All expansions</SelectItem>
              {decorExpansions().map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <PriceStamp asOf={prices.asOf} stale={prices.stale} />
          {prices.stale ? <Badge variant="outline">Stale cache</Badge> : null}
          <Button size="sm" variant="outline" onClick={() => void prices.refresh()}>
            Refresh
          </Button>
        </div>
      </div>
      {prices.error ? <p className="text-destructive text-xs">{prices.error}</p> : null}
      <div className="border-border overflow-hidden rounded-md border">
        <SortableTable
          rows={rows}
          rowKey={(row) => String(row.item.decorId)}
          columns={[
            { key: "name", header: "Decor", sortValue: (row) => row.item.name, cell: (row) => row.item.name },
            { key: "expansion", header: "Expansion", sortValue: (row) => row.item.expansion, cell: (row) => row.item.expansion },
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
              sortValue: (row) => row.cost.total,
              cell: (row) => (
                <span>
                  {formatCopper(row.cost.total)}
                  {row.cost.missing.length > 0 ? <span className="text-muted-foreground block text-[10px]">excludes {row.cost.missing.join(", ")}</span> : null}
                </span>
              ),
            },
          ]}
        />
      </div>
    </section>
  );
}
