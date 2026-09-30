export type Equipment = {
  slot: string;
  itemId: number;
  name: string;
};

export type ReagentOption = {
  itemId: number;
  name: string;
};

export type RecipeReagent = {
  quantity: number;
  options: ReagentOption[];
};

export type KnownRecipe = {
  id: number;
  name: string;
  itemId?: number;
  quantity?: number;
  reagents?: RecipeReagent[];
};

export type Profession = {
  id: number;
  name: string;
  skill: number;
  maxSkill: number;
  knowledge: Record<string, number>;
  equipment: Equipment[];
  recipes: KnownRecipe[];
};

export type Character = {
  name: string;
  realm: string;
  class: string;
  race: string;
  faction: string;
  professions: Profession[];
};

export type ExportPayload = {
  v: 1;
  exportedAt: number;
  characters: Character[];
};

export type Region = "eu" | "us" | "kr" | "tw";
