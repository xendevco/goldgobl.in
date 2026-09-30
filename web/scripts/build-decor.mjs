import { writeFileSync, readFileSync } from "node:fs";

const guide = readFileSync(process.env.GUIDE_HTML, "utf8");
const skillNames = {
  171: "Alchemy",
  164: "Blacksmithing",
  333: "Enchanting",
  202: "Engineering",
  773: "Inscription",
  755: "Jewelcrafting",
  165: "Leatherworking",
  197: "Tailoring",
  185: "Cooking",
};

const spells = [];
const seen = new Set();
const pattern = /"(\d+)":\{"name_enus":"((?:\\.|[^"\\])*)"/g;
let match;
while ((match = pattern.exec(guide))) {
  const id = Number(match[1]);
  const window = guide.slice(match.index, match.index + 280);
  if (!window.includes('"skillcategory":11') || seen.has(id)) continue;
  seen.add(id);
  spells.push(id);
}

function unescapeName(value) {
  return value.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16))).replace(/\\"/g, '"');
}

function itemName(html, itemId) {
  const found = new RegExp(`"${itemId}":\\{"name_enus":"((?:\\\\.|[^"\\\\])*)"`).exec(html);
  return found ? unescapeName(found[1]) : `Item ${itemId}`;
}

async function loadSpell(spellId) {
  const response = await fetch(`https://www.wowhead.com/spell=${spellId}`, {
    headers: { "user-agent": "Mozilla/5.0 GoldGoblin catalogue" },
  });
  if (!response.ok) throw new Error(`spell ${spellId} returned ${response.status}`);
  const html = await response.text();
  const title = /<title>([^<]+)<\/title>/.exec(html)?.[1]?.replace(/ - Spell - World of Warcraft$/, "") ?? `Spell ${spellId}`;
  const created = /"creates":\[(\d+)/.exec(html);
  const reagentList = /"reagents":\[((?:\[[0-9]+,[0-9]+\],?)*)\]/.exec(html);
  const skill = /"skill":\[(\d+)\]/.exec(html);
  if (!created || !skill) throw new Error(`spell ${spellId} has no crafted item`);
  const reagents = [];
  if (reagentList?.[1]) {
    for (const pair of reagentList[1].matchAll(/\[(\d+),(\d+)\]/g)) {
      reagents.push({
        itemId: Number(pair[1]),
        name: itemName(html, Number(pair[1])),
        quantity: Number(pair[2]),
      });
    }
  }
  return {
    itemId: Number(created[1]),
    decorId: Number(created[1]),
    name: title,
    profession: skillNames[Number(skill[1])] ?? `Skill ${skill[1]}`,
    recipeId: spellId,
    reagents,
  };
}

const items = [];
const failures = [];
for (let index = 0; index < spells.length; index += 4) {
  const batch = spells.slice(index, index + 4);
  const results = await Promise.all(
    batch.map(async (spellId) => {
      try {
        return await loadSpell(spellId);
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
        return null;
      }
    }),
  );
  items.push(...results.filter(Boolean));
  process.stderr.write(`fetched ${Math.min(index + 4, spells.length)} / ${spells.length}\n`);
}

items.sort((left, right) => left.name.localeCompare(right.name, "en-GB"));
writeFileSync(new URL("../src/data/decor.json", import.meta.url), `${JSON.stringify(items, null, 2)}\n`);
process.stderr.write(`wrote ${items.length} crafts, ${failures.length} failures\n`);
if (failures.length) process.stderr.write(`${failures.join("\n")}\n`);
