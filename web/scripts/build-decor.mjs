import { readFileSync, writeFileSync } from "node:fs";

const LUMBER_EXPANSION = {
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

const professions = [
  "Alchemy",
  "Blacksmithing",
  "Enchanting",
  "Engineering",
  "Inscription",
  "Jewelcrafting",
  "Leatherworking",
  "Tailoring",
  "Cooking",
];

function readBracket(text, start) {
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    if (text[index] === "[") depth += 1;
    else if (text[index] === "]") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

function recordsFrom(html) {
  const records = [];
  const marker = '"entityId":';
  let cursor = 0;
  while (cursor < html.length) {
    const index = html.indexOf(marker, cursor);
    if (index < 0) break;
    cursor = index + marker.length;
    const spellId = Number(/^(\d+)/.exec(html.slice(cursor))?.[1]);
    const next = html.indexOf(marker, cursor);
    const window = html.slice(index, next < 0 ? index + 12000 : next);
    const reagentAt = window.indexOf('"reagents":');
    const skillAt = window.indexOf('"skill":');
    if (!spellId || reagentAt < 0 || skillAt < 0 || reagentAt > skillAt) continue;
    const arrayText = readBracket(window, window.indexOf("[", reagentAt));
    const skillName = /"name":"([^"]+)"/.exec(window.slice(skillAt))?.[1];
    const profession = professions.find((name) => skillName?.endsWith(name));
    if (!arrayText || !profession) continue;
    let reagents;
    try {
      reagents = JSON.parse(arrayText)
        .map((reagent) => ({
          itemId: reagent.item,
          name: reagent.name,
          quantity: reagent.quantity,
        }))
        .filter((reagent) => reagent.itemId > 0 && reagent.quantity > 0);
    } catch {
      continue;
    }
    const tagged = /"groupName":"Expansion Aesthetic","id":\d+,"name":"([^"]+)"/.exec(window)?.[1];
    const craftName = /"entityId":\d+,"name":"((?:\\.|[^"\\])*)"/.exec(window)?.[1];
    const lumber = reagents.find((reagent) => reagent.name.endsWith("Lumber"));
    records.push({
      recipeId: spellId,
      name: craftName?.replace(/\\"/g, '"') ?? `Spell ${spellId}`,
      profession,
      expansion: (lumber && LUMBER_EXPANSION[lumber.name]) || tagged || skillName.slice(0, skillName.length - profession.length).trim(),
      reagents,
    });
  }
  return records;
}

async function createdItemId(spellId, reagentIds) {
  const response = await fetch(`https://nether.wowhead.com/tooltip/spell/${spellId}`, {
    headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36" },
  });
  if (!response.ok) throw new Error(`spell ${spellId} returned ${response.status}`);
  const text = await response.text();
  const reagentSet = new Set(reagentIds);
  const ignored = new Set([118722]);
  const extras = [...new Set([...text.matchAll(/item=(\d+)/g)].map((match) => Number(match[1])))].filter(
    (id) => !reagentSet.has(id) && !ignored.has(id),
  );
  if (extras.length === 1) return extras[0];
  throw new Error(`spell ${spellId} created item was ${extras.join(",") || "missing"}`);
}

const seen = new Set();
const records = [];
for (const path of process.argv.slice(2)) {
  for (const record of recordsFrom(readFileSync(path, "utf8"))) {
    if (seen.has(record.recipeId) || record.reagents.length === 0) continue;
    seen.add(record.recipeId);
    records.push(record);
  }
}

const outputPath = new URL("../src/data/decor.json", import.meta.url);
const existing = JSON.parse(readFileSync(outputPath, "utf8"));
const known = new Set(existing.map((item) => item.recipeId));
const pending = records.filter((record) => !known.has(record.recipeId));
process.stderr.write(`resuming ${pending.length} of ${records.length}\n`);

const failures = [];
const items = [...existing];
for (let index = 0; index < pending.length; index += 3) {
  const batch = pending.slice(index, index + 3);
  const created = await Promise.all(
    batch.map(async (record) => {
      try {
        return { ...record, itemId: await createdItemId(record.recipeId, record.reagents.map((reagent) => reagent.itemId)) };
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
        return null;
      }
    }),
  );
  items.push(...created.filter(Boolean));
  process.stderr.write(`items ${items.length} / ${records.length}\n`);
  await new Promise((resolve) => setTimeout(resolve, 400));
}

const byRecipe = new Map(records.map((record) => [record.recipeId, record]));
for (const item of items) {
  const source = byRecipe.get(item.recipeId);
  if (!source) continue;
  item.name = source.name;
  item.profession = source.profession;
  item.expansion = source.expansion;
  item.reagents = source.reagents;
}

items.sort((left, right) => left.expansion.localeCompare(right.expansion, "en-GB") || left.name.localeCompare(right.name, "en-GB"));
const catalogue = items.map((item) => ({
  itemId: item.itemId,
  decorId: item.itemId,
  name: item.name,
  profession: item.profession,
  expansion: item.expansion,
  recipeId: item.recipeId,
  reagents: item.reagents,
}));
writeFileSync(new URL("../src/data/decor.json", import.meta.url), `${JSON.stringify(catalogue, null, 2)}\n`);
process.stderr.write(`wrote ${catalogue.length}, failures ${failures.length}\n`);
if (failures.length) process.stderr.write(`${failures.slice(0, 20).join("\n")}\n`);
