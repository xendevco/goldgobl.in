import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SortableTable } from "@/components/SortableTable";
import { levellingRoutes } from "@/data/levelling-routes";
import { usePrices } from "@/hooks/usePrices";
import { formatCopper, formatPercent } from "@/lib/format";
import { cheapestPath } from "@/lib/levelling";

const professions = Object.keys(levellingRoutes);

export function LevellingPage() {
  const [profession, setProfession] = useState(professions[0] ?? "Inscription");
  const [skill, setSkill] = useState(50);
  const recipes = levellingRoutes[profession] ?? [];
  const itemIds = useMemo(() => [...new Set(recipes.flatMap((recipe) => recipe.reagents.map((reagent) => reagent.itemId)))], [recipes]);
  const prices = usePrices(itemIds);
  const cap = Math.max(...recipes.map((recipe) => recipe.greyAt), skill);
  const priceMap = new Map<number, number>();
  for (const itemId of itemIds) {
    const value = prices.quotes[itemId]?.marketValue;
    if (value != null) priceMap.set(itemId, value);
  }
  const path = cheapestPath(recipes, priceMap, skill, cap);
  const grouped = path.reduce<{ recipeName: string; from: number; to: number; expectedCopper: number; chance: number }[]>((steps, step) => {
    const last = steps.at(-1);
    if (last && last.recipeName === step.recipeName && last.chance === step.chance) {
      last.to = step.skill + 1;
      last.expectedCopper += step.expectedCopper;
      return steps;
    }
    steps.push({
      recipeName: step.recipeName,
      from: step.skill,
      to: step.skill + 1,
      expectedCopper: step.expectedCopper,
      chance: step.chance,
    });
    return steps;
  }, []);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Levelling optimiser</h1>
          <p className="text-muted-foreground text-xs">Cheapest expected path from the current skill to the grey cap, using live reagent prices.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={profession} onValueChange={setProfession}>
            <SelectTrigger size="sm" aria-label="Profession" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {professions.map((entry) => (
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
      {path.length === 0 ? (
        <p className="text-muted-foreground text-xs">No priced craft covers that skill. Inscription decor crafts in this catalogue start at 50.</p>
      ) : (
        <div className="border-border overflow-hidden rounded-md border">
          <SortableTable
            rows={grouped}
            initialKey="band"
            initialDirection="asc"
            rowKey={(row) => `${row.recipeName}-${row.from}`}
            columns={[
              { key: "recipe", header: "Craft", sortValue: (row) => row.from, cell: (row) => row.recipeName },
              { key: "band", header: "Skill", sortValue: (row) => row.from, cell: (row) => `${row.from} to ${row.to}` },
              { key: "chance", header: "Skill-up chance", align: "right", sortValue: (row) => row.chance, cell: (row) => formatPercent(row.chance) },
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
      )}
    </section>
  );
}
