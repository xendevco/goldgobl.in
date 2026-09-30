import { describe, expect, it } from "vitest";
import { arbitrageSpread, expectedArbitrage, rankSpreads } from "@/lib/arbitrage";
import { decodeExport, encodeExport, importRoster } from "@/lib/import";
import { cheapestPath, type LevellingRecipe } from "@/lib/levelling";
import { optimiseRoster } from "@/lib/roster";
import { cheapestSlotCost, expectedNet } from "@/lib/yield";
import { rosterCrafts } from "@/lib/crafts";
import { decorReagentIds } from "@/data/decor";
import type { Character, Profession } from "@/types/character";

function profession(name: string, skill: number, recipes: { id: number; name: string }[] = []): Profession {
  return { id: 1, name, skill, maxSkill: 100, knowledge: {}, equipment: [], recipes };
}

function character(name: string, race: string, professions: Profession[]): Character {
  return { name, realm: "Silvermoon", class: "MAGE", race, faction: "Horde", professions };
}

const roster: Character[] = [
  character("Anvil", "DarkIronDwarf", [profession("Blacksmithing", 70), profession("Tailoring", 20)]),
  character("Gem", "Draenei", [profession("Jewelcrafting", 100), profession("Enchanting", 40)]),
  character("Glimmer", "Goblin", [
    profession("Alchemy", 100, [{ id: 1233137, name: "Haranir Preserving Agents" }]),
    profession("Tailoring", 50),
  ]),
  character("Quill", "Nightborne", [profession("Inscription", 90), profession("Leatherworking", 10)]),
  character("Spark", "Gnome", [profession("Engineering", 80, [{ id: 1248611, name: "Ren'dorei Lightpost" }])]),
];

describe("syndicate matrix", () => {
  it("assigns a four-crafter roster with keep, learn, and cooldown tags", () => {
    const sheet = optimiseRoster(roster, 4);
    expect(sheet.map((seat) => seat.name)).toEqual(["Gem", "Glimmer", "Quill", "Spark"]);
    expect(sheet.find((seat) => seat.name === "Glimmer")?.professions).toEqual([
      { profession: "Alchemy", tags: ["Keep", "Cooldown Ready"], score: expect.any(Number) },
      { profession: "Tailoring", tags: ["Keep", "Cooldown Ready"], score: expect.any(Number) },
    ]);
    expect(sheet.find((seat) => seat.name === "Quill")?.professions[0]).toMatchObject({
      profession: "Inscription",
      tags: ["Missing Key Recipe"],
    });
    expect(sheet.find((seat) => seat.name === "Spark")?.professions.map((entry) => entry.profession)).toEqual([
      "Engineering",
      "Blacksmithing",
    ]);
    expect(sheet.find((seat) => seat.name === "Spark")?.professions[1].tags).toEqual(["Drop & Learn [Blacksmithing]"]);
    expect(new Set(sheet.flatMap((seat) => seat.professions.map((entry) => entry.profession))).size).toBe(8);
  });

  it("fills spare seats with racial cooldown alts", () => {
    const sheet = optimiseRoster(roster, 8);
    expect(sheet).toHaveLength(8);
    const races = sheet.filter((seat) => seat.isNew).map((seat) => seat.race);
    expect(races).toEqual(expect.arrayContaining(["Goblin", "KulTiran", "Draenei"]));
    const alchemy = sheet.flatMap((seat) => seat.professions).filter((entry) => entry.profession === "Alchemy");
    expect(alchemy.length).toBeGreaterThan(1);
  });
});

describe("yield maths", () => {
  it("nets sell value after procs and the auction house cut", () => {
    const net = expectedNet({
      reagentCost: 1000,
      sellPrice: 2000,
      saleRate: 0.5,
      multicraftChance: 0.2,
      resourcefulnessChance: 0.5,
      ingenuityChance: 0,
    });
    expect(net).toBeCloseTo(290);
  });
});

describe("arbitrage", () => {
  it("ranks by expected gold after the sale rate, not the raw spread", () => {
    expect(arbitrageSpread(10000, 15000)).toBeCloseTo(4250);
    expect(expectedArbitrage(1000, 12000, 0.8)).toBeCloseTo(8120);
    expect(expectedArbitrage(10000, 20000, 0.01)).toBeLessThan(0);
    expect(expectedArbitrage(10000, 20000, null)).toBeNull();
    const ranked = rankSpreads([
      {
        itemId: 2,
        name: "Lightpost",
        homePrice: 10000,
        remotePrice: 20000,
        remoteRealm: "Kazzak",
        spread: arbitrageSpread(10000, 20000),
        saleRate: 0.01,
        soldPerDay: 0.1,
        expected: expectedArbitrage(10000, 20000, 0.01),
      },
      {
        itemId: 1,
        name: "Scroll",
        homePrice: 1000,
        remotePrice: 12000,
        remoteRealm: "Draenor",
        spread: arbitrageSpread(1000, 12000),
        saleRate: 0.8,
        soldPerDay: 4,
        expected: expectedArbitrage(1000, 12000, 0.8),
      },
    ]);
    expect(ranked[0].itemId).toBe(1);
  });
});

describe("levelling path", () => {
  it("walks the cheapest skill-up at each point", () => {
    const recipes: LevellingRecipe[] = [
      { id: 1, name: "Trainer A", profession: "Alchemy", minSkill: 1, yellowAt: 20, greenAt: 30, greyAt: 40, reagents: [{ itemId: 1, quantity: 1 }] },
      { id: 2, name: "Trainer B", profession: "Alchemy", minSkill: 15, yellowAt: 40, greenAt: 40, greyAt: 40, reagents: [{ itemId: 2, quantity: 1 }] },
      { id: 3, name: "Trainer C", profession: "Alchemy", minSkill: 40, yellowAt: 100, greenAt: 100, greyAt: 101, reagents: [{ itemId: 3, quantity: 1 }] },
    ];
    const prices = new Map<number, number>([
      [1, 100],
      [2, 80],
      [3, 200],
    ]);
    const path = cheapestPath(recipes, prices, 1, 50);
    expect(path.slice(0, 14).every((step) => step.recipeName === "Trainer A")).toBe(true);
    expect(path.slice(14, 39).every((step) => step.recipeName === "Trainer B")).toBe(true);
    expect(path.slice(39).every((step) => step.recipeName === "Trainer C")).toBe(true);
    expect(path).toHaveLength(49);
  });
});

describe("GG1 import", () => {
  it("round-trips a payload and refuses a corrupt string", () => {
    const payload = {
      v: 1 as const,
      exportedAt: 1_700_000_000,
      characters: roster.slice(0, 1),
    };
    const encoded = encodeExport(payload);
    expect(encoded.startsWith("GG1:")).toBe(true);
    expect(decodeExport(encoded)).toEqual(payload);

    const merged = importRoster(roster.slice(0, 1), encodeExport({ ...payload, characters: roster.slice(1, 2) }), "merge");
    expect(merged.error).toBeNull();
    expect(merged.characters.map((entry) => entry.name)).toEqual(["Anvil", "Gem"]);

    const corrupt = importRoster(roster, "GG1:not-valid", "replace");
    expect(corrupt.error).toBeTruthy();
    expect(corrupt.characters).toBe(roster);
  });
});

describe("roster crafts", () => {
  it("prices the cheapest material in a required slot and keeps scanned recipes", () => {
    expect(
      cheapestSlotCost(
        [{ quantity: 2, options: [{ itemId: 1, name: "Silverleaf" }, { itemId: 2, name: "Peacebloom" }] }],
        new Map([
          [1, 100],
          [2, 40],
        ]),
      ),
    ).toEqual({ total: 80, missing: [] });

    const scanned = character("Quill", "Nightborne", [
      profession("Inscription", 90, []),
    ]);
    scanned.professions[0].recipes = [
      {
        id: 10,
        name: "Midnight Ink",
        itemId: 20,
        quantity: 1,
        reagents: [{ quantity: 1, options: [{ itemId: 1, name: "Pigment" }] }],
      },
      { id: 11, name: "Old scroll" },
    ];
    const result = rosterCrafts([scanned]);
    expect(result.crafts.map((craft) => craft.name)).toEqual(["Midnight Ink"]);
    expect(result.unscanned).toBe(1);
    expect(decodeExport(encodeExport({ v: 1, exportedAt: 1, characters: [scanned] })).characters[0].professions[0].recipes[0].itemId).toBe(20);
  });
});

describe("decor reagents", () => {
  it("asks only for reagent ids", () => {
    const ids = decorReagentIds();
    expect(ids).not.toContain(262601);
    expect(ids).toContain(256963);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
