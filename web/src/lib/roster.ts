import {
  COOLDOWN_PROFESSIONS,
  CRAFTING_PROFESSIONS,
  KEY_RECIPES,
  canonicalProfession,
  type CraftingProfession,
} from "@/data/professions";
import { bestRace, racialSkill } from "@/data/racial-bonuses";
import type { Character } from "@/types/character";

export type AssignmentTag = "Keep" | "Missing Key Recipe" | "Cooldown Ready" | `Drop & Learn [${string}]`;

export type ProfessionAssignment = {
  profession: CraftingProfession;
  tags: string[];
  score: number;
};

export type SeatAssignment = {
  name: string;
  realm: string;
  race: string;
  className: string;
  isNew: boolean;
  professions: ProfessionAssignment[];
};

type Seat = {
  name: string;
  realm: string;
  race: string;
  className: string;
  isNew: boolean;
  character: Character | null;
};

const COVERAGE_WEIGHT = 10_000;
const KNOWN_WEIGHT = 500;
const COOLDOWN_WEIGHT = 1_000;

function existingSkill(character: Character | null, profession: string): number {
  if (!character) return 0;
  let best = 0;
  for (const entry of character.professions) {
    if (canonicalProfession(entry.name) === profession) best = Math.max(best, entry.skill);
  }
  return best;
}

function recipeIds(character: Character | null): Set<number> {
  const ids = new Set<number>();
  if (!character) return ids;
  for (const profession of character.professions) {
    for (const recipe of profession.recipes) ids.add(recipe.id);
  }
  return ids;
}

function characterValue(character: Character): number {
  let total = 0;
  for (const profession of character.professions) {
    const name = canonicalProfession(profession.name);
    if (!name) continue;
    total += KNOWN_WEIGHT + profession.skill + racialSkill(character.race, name) * 100;
  }
  return total;
}

function combinations<T>(items: T[], count: number): T[][] {
  const results: T[][] = [];
  const current: T[] = [];
  const walk = (start: number) => {
    if (current.length === count) {
      results.push([...current]);
      return;
    }
    for (let index = start; index < items.length; index += 1) {
      current.push(items[index]);
      walk(index + 1);
      current.pop();
    }
  };
  walk(0);
  return results;
}

function toSeat(character: Character): Seat {
  return {
    name: character.name,
    realm: character.realm,
    race: character.race,
    className: character.class,
    isNew: false,
    character,
  };
}

function slotScore(seat: Seat, profession: CraftingProfession, covering: boolean): number {
  const racial = racialSkill(seat.race, profession);
  const existing = existingSkill(seat.character, profession);
  let score = racial * 100 + existing;
  if (existing > 0) score += KNOWN_WEIGHT;
  if (covering) score += COVERAGE_WEIGHT;
  else if (COOLDOWN_PROFESSIONS.includes(profession)) score += COOLDOWN_WEIGHT;
  return score;
}

function assignToSeats(seats: Seat[]): { seats: SeatAssignment[]; score: number; covered: number } {
  const slots: { seat: number; profession: CraftingProfession | null; score: number }[] = [];
  for (let index = 0; index < seats.length; index += 1) {
    slots.push({ seat: index, profession: null, score: 0 }, { seat: index, profession: null, score: 0 });
  }
  const uncovered = new Set<CraftingProfession>(CRAFTING_PROFESSIONS);

  const takeBest = (pool: readonly CraftingProfession[], covering: boolean) => {
    let best: { slot: number; profession: CraftingProfession; score: number } | null = null;
    for (let slot = 0; slot < slots.length; slot += 1) {
      if (slots[slot].profession) continue;
      const seat = seats[slots[slot].seat];
      const taken = new Set(slots.filter((entry) => entry.seat === slots[slot].seat && entry.profession).map((entry) => entry.profession));
      for (const profession of pool) {
        if (taken.has(profession)) continue;
        const score = slotScore(seat, profession, covering);
        if (
          !best ||
          score > best.score ||
          (score === best.score && profession < best.profession) ||
          (score === best.score && profession === best.profession && slot < best.slot)
        ) {
          best = { slot, profession, score };
        }
      }
    }
    if (!best) return false;
    slots[best.slot].profession = best.profession;
    slots[best.slot].score = best.score;
    return best.profession;
  };

  while (uncovered.size > 0) {
    const profession = takeBest([...uncovered], true);
    if (!profession) break;
    uncovered.delete(profession);
  }

  while (slots.some((slot) => !slot.profession)) {
    const profession = takeBest(COOLDOWN_PROFESSIONS, false);
    if (!profession) break;
  }

  let score = uncovered.size === 0 ? CRAFTING_PROFESSIONS.length * 1_000_000 : (CRAFTING_PROFESSIONS.length - uncovered.size) * 1_000_000;
  const assigned: SeatAssignment[] = seats.map((seat) => ({
    name: seat.name,
    realm: seat.realm,
    race: seat.race,
    className: seat.className,
    isNew: seat.isNew,
    professions: [],
  }));

  for (const slot of slots) {
    if (!slot.profession) continue;
    score += slot.score;
    const seat = seats[slot.seat];
    const known = recipeIds(seat.character);
    const keys = KEY_RECIPES[slot.profession] ?? [];
    const missingKey = keys.some((id) => !known.has(id));
    const existing = existingSkill(seat.character, slot.profession);
    const tags: string[] = [];
    if (existing > 0 && missingKey) tags.push("Missing Key Recipe");
    else if (existing > 0) tags.push("Keep");
    else tags.push(`Drop & Learn [${slot.profession}]`);
    if (existing > 0 && !missingKey && COOLDOWN_PROFESSIONS.includes(slot.profession)) tags.push("Cooldown Ready");
    assigned[slot.seat].professions.push({ profession: slot.profession, tags, score: slot.score });
  }

  return {
    seats: assigned.sort((a, b) => a.name.localeCompare(b.name)),
    score,
    covered: CRAFTING_PROFESSIONS.length - uncovered.size,
  };
}

function greedyChoose(characters: Character[], capacity: number): Character[] {
  return [...characters].sort((a, b) => characterValue(b) - characterValue(a) || a.name.localeCompare(b.name)).slice(0, capacity);
}

function chooseCharacters(characters: Character[], capacity: number): Character[] {
  if (characters.length <= capacity) return characters;
  const estimate = factorialRatio(characters.length, capacity);
  if (estimate > 20_000) return greedyChoose(characters, capacity);
  let best = characters.slice(0, capacity);
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const combo of combinations(characters, capacity)) {
    const result = assignToSeats(combo.map(toSeat));
    const tie = combo.map((character) => character.name).sort().join("|");
    const bestTie = best.map((character) => character.name).sort().join("|");
    if (result.score > bestScore || (result.score === bestScore && tie < bestTie)) {
      bestScore = result.score;
      best = combo;
    }
  }
  return best;
}

function factorialRatio(total: number, count: number): number {
  let value = 1;
  for (let index = 0; index < count; index += 1) value *= (total - index) / (index + 1);
  return value;
}

export function optimiseRoster(characters: Character[], capacity: number): SeatAssignment[] {
  const safeCapacity = Math.max(1, Math.min(50, Math.floor(capacity)));
  const chosen = chooseCharacters(characters, safeCapacity).map(toSeat);
  const seats = [...chosen];
  let cursor = 0;
  while (seats.length < safeCapacity) {
    const profession = COOLDOWN_PROFESSIONS[cursor % COOLDOWN_PROFESSIONS.length];
    cursor += 1;
    const race = bestRace(profession);
    const number = seats.length - chosen.length + 1;
    seats.push({
      name: `New alt ${number}`,
      realm: "Any realm",
      race,
      className: "",
      isNew: true,
      character: null,
    });
  }
  return assignToSeats(seats).seats;
}
