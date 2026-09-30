import { canonicalProfession } from "@/data/professions";
import type { Character, RecipeReagent } from "@/types/character";

export type RosterCraft = {
  recipeId: number;
  name: string;
  profession: string;
  itemId: number;
  quantity: number;
  reagents: RecipeReagent[];
  crafters: string[];
};

export function rosterCrafts(characters: Character[]): { crafts: RosterCraft[]; unscanned: number } {
  const byRecipe = new Map<number, RosterCraft>();
  let unscanned = 0;
  for (const character of characters) {
    for (const profession of character.professions) {
      const professionName = canonicalProfession(profession.name) ?? (profession.name.toLowerCase().includes("cooking") ? "Cooking" : null);
      if (!professionName) continue;
      for (const recipe of profession.recipes) {
        if (!recipe.itemId || !recipe.reagents?.length) {
          unscanned += 1;
          continue;
        }
        const existing = byRecipe.get(recipe.id);
        if (existing) {
          if (!existing.crafters.includes(character.name)) existing.crafters.push(character.name);
          continue;
        }
        byRecipe.set(recipe.id, {
          recipeId: recipe.id,
          name: recipe.name || `Recipe ${recipe.id}`,
          profession: professionName,
          itemId: recipe.itemId,
          quantity: recipe.quantity && recipe.quantity > 0 ? recipe.quantity : 1,
          reagents: recipe.reagents,
          crafters: [character.name],
        });
      }
    }
  }
  return { crafts: [...byRecipe.values()], unscanned };
}

export function craftReagentIds(crafts: RosterCraft[]): number[] {
  const ids = new Set<number>();
  for (const craft of crafts) {
    for (const slot of craft.reagents) {
      for (const option of slot.options) ids.add(option.itemId);
    }
  }
  return [...ids];
}
