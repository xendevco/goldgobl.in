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
  reagents: { itemId: number; quantity: number }[];
};

export type CraftStep = {
  skill: number;
  recipeId: number;
  recipeName: string;
  chance: number;
  expectedCopper: number;
};

export function chanceAt(recipe: LevellingRecipe, skill: number): number {
  if (skill < recipe.minSkill || skill >= recipe.greyAt) return 0;
  if (skill < recipe.yellowAt) return skillUpChance.orange;
  if (skill < recipe.greenAt) return skillUpChance.yellow;
  return skillUpChance.green;
}

function recipeCost(recipe: LevellingRecipe, prices: Map<number, number>): number | null {
  let total = 0;
  for (const reagent of recipe.reagents) {
    const price = prices.get(reagent.itemId);
    if (price == null) return null;
    total += price * reagent.quantity;
  }
  return total;
}

export function cheapestPath(
  recipes: LevellingRecipe[],
  prices: Map<number, number>,
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
      const chance = chanceAt(recipe, skill);
      if (chance <= 0) continue;
      const cost = recipeCost(recipe, prices);
      if (cost == null) continue;
      const expectedCopper = cost / chance;
      const next = skill + 1;
      const nextDist = current + expectedCopper;
      if (nextDist < (dist.get(next) ?? Number.POSITIVE_INFINITY)) {
        dist.set(next, nextDist);
        previous.set(next, {
          skill,
          recipeId: recipe.id,
          recipeName: recipe.name,
          chance,
          expectedCopper,
        });
      }
    }
  }

  if (!dist.has(toSkill)) return [];
  const steps: CraftStep[] = [];
  for (let skill = toSkill; skill > fromSkill; skill -= 1) {
    const step = previous.get(skill);
    if (!step) return [];
    steps.push(step);
  }
  return steps.reverse();
}
