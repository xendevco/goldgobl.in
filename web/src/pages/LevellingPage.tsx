import { useMemo, useState } from "react";
import { PriceStamp } from "@/components/PriceStamp";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SortableTable } from "@/components/SortableTable";
import { CRAFTING_PROFESSIONS } from "@/data/professions";
import { levellingRoutes, levellingShopping } from "@/data/levelling-routes";
import { usePrices } from "@/hooks/usePrices";
import { formatCopper, formatPercent } from "@/lib/format";
import { cheapestPath, recipeCost } from "@/lib/levelling";
import { expectedRevenue } from "@/lib/yield";

const cap = 100;

function soldLabel(soldPerDay: number | null) {
  if (soldPerDay == null) return "n/a";
  return soldPerDay >= 10 ? `${Math.round(soldPerDay)}` : `${Math.round(soldPerDay * 10) / 10}`;
}

function priceMapFrom(quotes: Record<number, { marketValue: number | null }>, itemIds: number[]) {
  const prices = new Map<number, number | null>();
  for (const itemId of itemIds) prices.set(itemId, quotes[itemId]?.marketValue ?? null);
  return prices;
}

export function LevellingPage() {
  const [profession, setProfession] = useState<(typeof CRAFTING_PROFESSIONS)[number]>("Alchemy");
  const [skill, setSkill] = useState(1);
  const recipes = levellingRoutes[profession] ?? [];
  const shopping = levellingShopping[profession] ?? [];
  const itemIds = useMemo(() => {
    const ids = [
      ...recipes.flatMap((recipe) => [recipe.itemId ?? 0, ...recipe.reagents.map((reagent) => reagent.itemId)]),
      ...shopping.map((item) => item.itemId),
    ];
    return [...new Set(ids.filter((itemId) => itemId > 0))];
  }, [recipes, shopping]);
  const prices = usePrices(itemIds);
  const priced = priceMapFrom(prices.quotes, itemIds);
  const start = Math.min(Math.max(skill, 1), cap);
  const segments = useMemo(() => {
    const built: { from: number; to: number; rows: { recipeName: string; from: number; to: number; expectedCopper: number; chance: number; crafts?: number; assumed?: boolean }[]; cost: number }[] = [];
    let cursor = start;
    const covered = new Set<number>();
    while (cursor < cap && !covered.has(cursor)) {
      covered.add(cursor);
      const path = cheapestPath(recipes, priced, cursor, cap);
      const end = path.at(-1)?.nextSkill ?? cursor;
      if (path.length > 0 && end > cursor) {
        const rows = path.reduce<{ recipeName: string; from: number; to: number; expectedCopper: number; chance: number; crafts?: number; assumed?: boolean }[]>((steps, step) => {
          const last = steps.at(-1);
          if (last && !last.crafts && !step.crafts && last.assumed === step.assumed && last.recipeName === step.recipeName && last.chance === step.chance && last.to === step.skill) {
            last.to = step.nextSkill;
            last.expectedCopper += step.expectedCopper;
            return steps;
          }
          steps.push({
            recipeName: step.recipeName,
            from: step.skill,
            to: step.nextSkill,
            expectedCopper: step.expectedCopper,
            chance: step.chance,
            crafts: step.crafts,
            assumed: step.assumed,
          });
          return steps;
        }, []);
        built.push({ from: cursor, to: end, rows, cost: rows.reduce((total, row) => total + row.expectedCopper, 0) });
        cursor = end;
        continue;
      }
      const next = recipes.reduce((soonest, recipe) => (recipe.concentrationOnly || recipe.minSkill <= cursor ? soonest : Math.min(soonest, recipe.minSkill)), cap);
      if (next >= cap) break;
      cursor = next;
    }
    return built;
  }, [priced, recipes, start]);
  const pathCost = segments.reduce((total, segment) => total + segment.cost, 0);
  const reached = segments.at(-1)?.to ?? start;

  const concentration = useMemo(() => {
    const seen = new Set<number>();
    const rows: {
      name: string;
      cost: number;
      missing: string[];
      sell: number | null;
      saleRate: number | null;
      soldPerDay: number | null;
      net: number | null;
    }[] = [];
    for (const recipe of recipes) {
        if (recipe.once || recipe.free || recipe.id <= 0 || !recipe.itemId || seen.has(recipe.id)) continue;
      seen.add(recipe.id);
      const cost = recipeCost(recipe, priced);
      if (!cost) continue;
      const quote = prices.quotes[recipe.itemId];
      const sell = quote?.marketValue ?? null;
      const saleRate = quote?.saleRate ?? null;
      const net =
        sell != null && saleRate != null
          ? expectedRevenue({
              sellPrice: sell,
              saleRate,
              multicraftChance: 0,
              resourcefulnessChance: 0,
              ingenuityChance: 0,
            }) - cost.total
          : null;
      rows.push({
        name: recipe.name,
        cost: cost.total,
        missing: cost.missing,
        sell,
        saleRate,
        soldPerDay: quote?.soldPerDay ?? null,
        net,
      });
    }
    return rows.sort((left, right) => (right.net ?? Number.NEGATIVE_INFINITY) - (left.net ?? Number.NEGATIVE_INFINITY) || left.name.localeCompare(right.name));
  }, [prices.quotes, priced, recipes]);

  const shoppingCost = shopping.reduce((total, item) => {
    const price = priced.get(item.itemId);
    return price == null ? total : total + price * item.quantity;
  }, 0);
  const shoppingMissing = shopping.filter((item) => item.itemId <= 0 || priced.get(item.itemId) == null).map((item) => item.name);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Levelling optimiser</h1>
          <p className="text-muted-foreground max-w-3xl text-xs">
            Cheapest path from your current skill, using the craft counts and skill colours in the Midnight levelling guides. Where a guide only says to first-craft every trainer recipe, that stretch uses its shopping list.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PriceStamp asOf={prices.asOf} stale={prices.stale} />
          <Select value={profession} onValueChange={(value) => setProfession(value as (typeof CRAFTING_PROFESSIONS)[number])}>
            <SelectTrigger size="sm" aria-label="Profession" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CRAFTING_PROFESSIONS.map((entry) => (
                <SelectItem key={entry} value={entry}>
                  {entry}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="text-muted-foreground flex items-center gap-2 text-xs">
            Current skill
            <Input
              aria-label="Current skill"
              className="h-8 w-16"
              type="number"
              min={1}
              max={cap}
              value={skill}
              onChange={(event) => setSkill(Number(event.target.value))}
            />
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Cheapest path</h2>
        {prices.error ? (
          <p className="text-muted-foreground text-xs">Auction prices did not load. {prices.error}</p>
        ) : prices.loading && !prices.settled ? (
          <p className="text-muted-foreground text-xs">Loading auction prices.</p>
        ) : segments.length === 0 ? (
          <p className="text-muted-foreground text-xs">No priced step starts at skill {skill}. The shopping list below is what the guide tells you to buy.</p>
        ) : (
          <>
            <p className="text-muted-foreground text-xs">
              Priced steps reach skill {reached} for about {formatCopper(pathCost)}.
              {reached < cap ? " The guide has no priced craft for the skill after that." : ""}
            </p>
            {segments.map((segment, index) => {
              const previous = index === 0 ? start : segments[index - 1].to;
              return (
                <div key={segment.from} className="space-y-2">
                  {segment.from > previous ? (
                    <p className="text-muted-foreground text-xs">No listed craft from {previous} to {segment.from}.</p>
                  ) : null}
                  <div className="border-border overflow-hidden rounded-md border">
                    <SortableTable
                      rows={segment.rows}
                      initialKey="band"
                      initialDirection="asc"
                      rowKey={(row) => `${row.recipeName}-${row.from}`}
                      columns={[
                        { key: "recipe", header: "Craft", sortValue: (row) => row.from, cell: (row) => row.recipeName },
                        { key: "band", header: "Skill", sortValue: (row) => row.from, cell: (row) => `${row.from} to ${row.to}` },
                        {
                          key: "chance",
                          header: "Skill-up chance",
                          align: "right",
                          sortValue: (row) => row.chance,
                          cell: (row) => (row.crafts ? `${row.crafts} crafts` : row.assumed ? "1 point per craft" : formatPercent(row.chance)),
                        },
                        {
                          key: "cost",
                          header: "Expected cost",
                          align: "right",
                          sortValue: (row) => row.expectedCopper,
                          cell: (row) => formatCopper(row.expectedCopper),
                        },
                      ]}
                    />
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {shopping.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Guide shopping list</h2>
          <p className="text-muted-foreground text-xs">
            Materials the guide lists for the early stretch.
            {prices.settled
              ? ` Priced lines come to ${formatCopper(shoppingCost)}${shoppingMissing.length > 0 ? `. No auction price for ${shoppingMissing.join(", ")}` : ""}.`
              : " Pricing the shopping list."}
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Best concentration crafts</h2>
        <p className="text-muted-foreground max-w-3xl text-xs">
          Ranked by expected gold: sale price after the 5% auction cut, times the regional sale rate, minus reagent cost. The guides do not publish how much concentration a craft spends, so this is cost against sale rate.
        </p>
        {prices.loading && !prices.settled ? (
          <p className="text-muted-foreground text-xs">Loading auction prices.</p>
        ) : concentration.length === 0 ? (
          <p className="text-muted-foreground text-xs">No priced craft with a sale value for {profession} yet.</p>
        ) : (
          <div className="border-border overflow-hidden rounded-md border">
            <SortableTable
              rows={concentration}
              initialKey="net"
              initialDirection="desc"
              rowKey={(row) => row.name}
              columns={[
                { key: "craft", header: "Craft", sortValue: (row) => row.name, cell: (row) => row.name },
                {
                  key: "cost",
                  header: "Reagent cost",
                  align: "right",
                  sortValue: (row) => row.cost,
                  cell: (row) => (row.missing.length > 0 ? `${formatCopper(row.cost)}*` : formatCopper(row.cost)),
                },
                { key: "sell", header: "Market", align: "right", sortValue: (row) => row.sell ?? -1, cell: (row) => formatCopper(row.sell) },
                { key: "sold", header: "Sold / day", align: "right", sortValue: (row) => row.soldPerDay ?? -1, cell: (row) => soldLabel(row.soldPerDay) },
                {
                  key: "rate",
                  header: "Sale rate",
                  align: "right",
                  sortValue: (row) => row.saleRate ?? -1,
                  cell: (row) => (row.saleRate == null ? "n/a" : formatPercent(row.saleRate)),
                },
                {
                  key: "net",
                  header: "Expected",
                  align: "right",
                  sortValue: (row) => row.net ?? Number.NEGATIVE_INFINITY,
                  cell: (row) => formatCopper(row.net),
                },
              ]}
            />
          </div>
        )}
      </div>
    </section>
  );
}
