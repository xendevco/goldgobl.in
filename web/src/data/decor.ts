import decorJson from "@/data/decor.json";
import type { CraftingProfession } from "@/data/professions";

export type DecorReagent = {
  itemId: number;
  name: string;
  quantity: number;
};

export type DecorProfession = CraftingProfession | "Cooking";

export const DECOR_EXPANSIONS = [
  "Midnight",
  "The War Within",
  "Dragonflight",
  "Shadowlands",
  "Battle for Azeroth",
  "Legion",
  "Warlords of Draenor",
  "Mists of Pandaria",
  "Cataclysm",
  "Wrath of the Lich King",
  "Burning Crusade",
  "Classic",
] as const;

export type DecorExpansion = (typeof DECOR_EXPANSIONS)[number];

export type DecorItem = {
  itemId: number;
  decorId: number;
  name: string;
  profession: DecorProfession;
  expansion: DecorExpansion | string;
  recipeId: number;
  reagents: DecorReagent[];
};

export const decorItems = decorJson as DecorItem[];

export const THALASSIAN_LUMBER_ID = 256963;

export function isLumberReagent(reagent: { name: string }): boolean {
  return reagent.name.endsWith("Lumber");
}

export function decorExpansions(items: DecorItem[] = decorItems): string[] {
  const present = new Set(items.map((item) => item.expansion));
  const known = DECOR_EXPANSIONS.filter((expansion) => present.has(expansion));
  const extra = [...present].filter((expansion) => !known.includes(expansion as DecorExpansion)).sort();
  return [...known, ...extra];
}

export function decorReagentIds(items: DecorItem[] = decorItems): number[] {
  const ids = new Set<number>();
  for (const item of items) {
    for (const reagent of item.reagents) ids.add(reagent.itemId);
  }
  return [...ids].sort((left, right) => left - right);
}
