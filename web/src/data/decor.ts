import decorJson from "@/data/decor.json";
import type { CraftingProfession } from "@/data/professions";

export type DecorReagent = {
  itemId: number;
  name: string;
  quantity: number;
};

export type DecorItem = {
  itemId: number;
  decorId: number;
  name: string;
  profession: CraftingProfession;
  recipeId: number;
  reagents: DecorReagent[];
};

export const decorItems = decorJson as DecorItem[];

export const THALASSIAN_LUMBER_ID = 256963;

export function decorReagentIds(items: DecorItem[] = decorItems): number[] {
  const ids = new Set<number>();
  for (const item of items) {
    for (const reagent of item.reagents) ids.add(reagent.itemId);
  }
  return [...ids].sort((left, right) => left - right);
}
