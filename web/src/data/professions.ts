export const CRAFTING_PROFESSIONS = [
  "Alchemy",
  "Blacksmithing",
  "Enchanting",
  "Engineering",
  "Inscription",
  "Jewelcrafting",
  "Leatherworking",
  "Tailoring",
] as const;

export type CraftingProfession = (typeof CRAFTING_PROFESSIONS)[number];

export const COOLDOWN_PROFESSIONS: CraftingProfession[] = ["Alchemy", "Tailoring", "Jewelcrafting"];

/** Recipe spell ids worth flagging when a crafter is missing them. */
export const KEY_RECIPES: Partial<Record<CraftingProfession, number[]>> = {
  Alchemy: [1233137],
  Engineering: [1248611],
  Inscription: [1248628],
};

export function canonicalProfession(name: string): CraftingProfession | null {
  const lower = name.toLowerCase();
  return CRAFTING_PROFESSIONS.find((profession) => lower.includes(profession.toLowerCase())) ?? null;
}
