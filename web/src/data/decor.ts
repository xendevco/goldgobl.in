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

export const THALASSIAN_LUMBER_ID = 256963;

const LUMBER_EXPANSION: Record<string, DecorExpansion> = {
  "Thalassian Lumber": "Midnight",
  "Dornic Fir Lumber": "The War Within",
  "Dragonpine Lumber": "Dragonflight",
  "Arden Lumber": "Shadowlands",
  "Darkpine Lumber": "Battle for Azeroth",
  "Fel-Touched Lumber": "Legion",
  "Shadowmoon Lumber": "Warlords of Draenor",
  "Bamboo Lumber": "Mists of Pandaria",
  "Ashwood Lumber": "Cataclysm",
  "Coldwind Lumber": "Wrath of the Lich King",
  "Olemba Lumber": "Burning Crusade",
  "Ironwood Lumber": "Classic",
};

export function isLumberReagent(reagent: { name: string }): boolean {
  return reagent.name.endsWith("Lumber");
}

export function expansionFromReagents(reagents: { name: string }[], fallback: string): string {
  const lumber = reagents.find(isLumberReagent);
  return (lumber && LUMBER_EXPANSION[lumber.name]) || fallback;
}

export const decorItems = (decorJson as DecorItem[]).map((item) => ({
  ...item,
  expansion: expansionFromReagents(item.reagents, item.expansion),
}));

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
