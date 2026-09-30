import catalogue from "@/data/levelling.json";
import type { LevellingRecipe } from "@/lib/levelling";

export type ShoppingItem = {
  itemId: number;
  name: string;
  quantity: number;
};

type RouteFile = Record<string, { recipes: LevellingRecipe[]; shopping: ShoppingItem[] }>;

const routes = catalogue as RouteFile;

export const levellingRoutes: Record<string, LevellingRecipe[]> = Object.fromEntries(
  Object.entries(routes).map(([profession, route]) => [profession, route.recipes]),
);

export const levellingShopping: Record<string, ShoppingItem[]> = Object.fromEntries(
  Object.entries(routes).map(([profession, route]) => [profession, route.shopping]),
);
