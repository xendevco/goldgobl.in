import type { LevellingRecipe } from "@/lib/levelling";

/**
 * Wild Hanging Scroll colour bands are the published 50 / 85 / 92 / 100 skill thresholds.
 * The route starts at 50 because earlier Midnight inscription bands are not published here.
 */
export const inscriptionRoute: LevellingRecipe[] = [
  {
    id: 1248628,
    name: "Wild Hanging Scroll",
    profession: "Inscription",
    minSkill: 50,
    yellowAt: 85,
    greenAt: 92,
    greyAt: 100,
    reagents: [
      { itemId: 256963, quantity: 8 },
      { itemId: 245764, quantity: 3 },
      { itemId: 245766, quantity: 2 },
    ],
  },
];

export const levellingRoutes: Record<string, LevellingRecipe[]> = {
  Inscription: inscriptionRoute,
};
