import type { CraftingProfession } from "@/data/professions";

export type RacialBonus = {
  race: string;
  profession: CraftingProfession | "*";
  skill: number;
  trait: string;
};

/**
 * Midnight still uses the Dragonflight profession racial skill values.
 * Kul Tiran Jack of All Trades applies to every crafting profession.
 */
export const racialBonuses: RacialBonus[] = [
  { race: "BloodElf", profession: "Enchanting", skill: 5, trait: "Arcane Affinity" },
  { race: "DarkIronDwarf", profession: "Blacksmithing", skill: 5, trait: "Mass Production" },
  { race: "Draenei", profession: "Jewelcrafting", skill: 5, trait: "Gemcutting" },
  { race: "Gnome", profession: "Engineering", skill: 5, trait: "Engineering Specialisation" },
  { race: "Goblin", profession: "Alchemy", skill: 5, trait: "Better Living Through Chemistry" },
  { race: "LightforgedDraenei", profession: "Blacksmithing", skill: 5, trait: "Forge of Light" },
  { race: "Nightborne", profession: "Inscription", skill: 5, trait: "Ancient History" },
  { race: "KulTiran", profession: "*", skill: 2, trait: "Jack of All Trades" },
];

export function normaliseRace(race: string): string {
  return race.toLowerCase().replace(/[^a-z]/g, "");
}

export function racialSkill(race: string, profession: string): number {
  const token = normaliseRace(race);
  let best = 0;
  for (const bonus of racialBonuses) {
    if (normaliseRace(bonus.race) !== token) continue;
    if (bonus.profession === "*" || bonus.profession === profession) {
      best = Math.max(best, bonus.skill);
    }
  }
  return best;
}

export function bestRace(profession: CraftingProfession): string {
  let race = "KulTiran";
  let skill = racialSkill(race, profession);
  for (const bonus of racialBonuses) {
    if (bonus.profession !== profession) continue;
    const value = racialSkill(bonus.race, profession);
    if (value > skill) {
      skill = value;
      race = bonus.race;
    }
  }
  return race;
}
