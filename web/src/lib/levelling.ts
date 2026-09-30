export const skillUpChance = {
  orange: 1,
  yellow: 0.75,
  green: 0.25,
  grey: 0,
} as const;

export type LevellingRecipe = {
  id: number;
  name: string;
  profession: string;
  minSkill: number;
  yellowAt: number;
  greenAt: number;
  greyAt: number;
  skillPoints?: number;
  flatChance?: number;
  guideCrafts?: number;
  once?: boolean;
  assumed?: boolean;
  concentrationOnly?: boolean;
  free?: boolean;
  itemId?: number | null;
  reagents: { itemId: number; name?: string; quantity: number }[];
};

export type CraftStep = {
  skill: number;
  nextSkill: number;
  recipeId: number;
  recipeName: string;
  chance: number;
  crafts?: number;
  assumed?: boolean;
  expectedCopper: number;
};

export function chanceAt(recipe: LevellingRecipe, skill: number): number {
  if (skill < recipe.minSkill || skill >= recipe.greyAt) return 0;
  if (recipe.flatChance != null) return recipe.flatChance;
  if (skill < recipe.yellowAt) return skillUpChance.orange;
  if (skill < recipe.greenAt) return skillUpChance.yellow;
  return skillUpChance.green;
}

export function recipeCost(
  recipe: LevellingRecipe,
  prices: Map<number, number | null>,
  lumberCopper = 0,
): { total: number; missing: string[] } | null {
  if (recipe.free) return { total: 0, missing: [] };
  if (recipe.reagents.length === 0) return null;
  let total = 0;
  let priced = 0;
  const missing: string[] = [];
  for (const reagent of recipe.reagents) {
    if (reagent.name?.endsWith("Lumber")) {
      total += lumberCopper * reagent.quantity;
      priced += 1;
      continue;
    }
    if (reagent.itemId <= 0) {
      missing.push(reagent.name ?? "Unpriced material");
      continue;
    }
    const price = prices.get(reagent.itemId);
    if (price == null) missing.push(reagent.name ?? String(reagent.itemId));
    else {
      total += price * reagent.quantity;
      priced += 1;
    }
  }
  if (priced === 0) return null;
  return { total, missing };
}

export function cheapestPath(
  recipes: LevellingRecipe[],
  prices: Map<number, number | null>,
  fromSkill: number,
  toSkill: number,
): CraftStep[] {
  if (fromSkill >= toSkill) return [];

  const dist = new Map<number, number>([[fromSkill, 0]]);
  const previous = new Map<number, CraftStep>();

  for (let skill = fromSkill; skill < toSkill; skill += 1) {
    const current = dist.get(skill);
    if (current == null) continue;
    for (const recipe of recipes) {
      if (recipe.concentrationOnly) continue;
      const cost = recipeCost(recipe, prices);
      if (cost == null) continue;
      const jumpTo = recipe.once || recipe.guideCrafts ? recipe.greyAt : null;
      if (jumpTo != null) {
        if (skill !== recipe.minSkill || jumpTo > toSkill || jumpTo <= skill) continue;
        const expectedCopper = recipe.once ? cost.total : cost.total * (recipe.guideCrafts ?? 1);
        const nextDist = current + expectedCopper;
        if (nextDist < (dist.get(jumpTo) ?? Number.POSITIVE_INFINITY)) {
          dist.set(jumpTo, nextDist);
          previous.set(jumpTo, {
            skill,
            nextSkill: jumpTo,
            recipeId: recipe.id,
            recipeName: recipe.name,
            chance: 1,
            crafts: recipe.guideCrafts,
            expectedCopper,
          });
        }
        continue;
      }
      const chance = chanceAt(recipe, skill);
      if (chance <= 0) continue;
      const points = recipe.skillPoints && recipe.skillPoints > 0 ? recipe.skillPoints : 1;
      const expectedCopper = cost.total / (chance * points);
      const next = skill + 1;
      const nextDist = current + expectedCopper;
      if (nextDist < (dist.get(next) ?? Number.POSITIVE_INFINITY)) {
        dist.set(next, nextDist);
        previous.set(next, {
          skill,
          nextSkill: next,
          recipeId: recipe.id,
          recipeName: recipe.name,
          chance,
          assumed: recipe.assumed === true,
          expectedCopper,
        });
      }
    }
  }

  let furthest = fromSkill;
  for (const skill of dist.keys()) {
    if (skill <= toSkill && skill > furthest) furthest = skill;
  }
  if (furthest <= fromSkill) return [];
  const steps: CraftStep[] = [];
  let cursor = furthest;
  while (cursor > fromSkill) {
    const step = previous.get(cursor);
    if (!step) return [];
    steps.push(step);
    cursor = step.skill;
  }
  return steps.reverse();
}
