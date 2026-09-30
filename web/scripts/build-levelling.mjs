import { readFileSync, writeFileSync } from "node:fs";

const GUIDE_URLS = [
  ["Alchemy", "https://www.wow-professions.com/guides/wow-alchemy-leveling-guide"],
  ["Blacksmithing", "https://www.wow-professions.com/guides/wow-blacksmithing-leveling-guide"],
  ["Enchanting", "https://www.wow-professions.com/guides/wow-enchanting-leveling-guide"],
  ["Engineering", "https://www.wow-professions.com/guides/wow-engineering-leveling-guide"],
  ["Inscription", "https://www.wow-professions.com/guides/wow-inscription-leveling-guide"],
  ["Jewelcrafting", "https://www.wow-professions.com/guides/wow-jewelcrafting-leveling-guide"],
  ["Leatherworking", "https://www.wow-professions.com/guides/wow-leatherworking-leveling-guide"],
  ["Tailoring", "https://www.wow-professions.com/guides/wow-tailoring-leveling-guide"],
];

function plain(html) {
  return html
    .replace(/<img[^>]*>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function itemNames(html) {
  const byName = new Map();
  for (const match of html.matchAll(/href="https:\/\/www\.wowhead\.com\/item=(\d+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const name = plain(match[2]);
    if (name) byName.set(name.toLowerCase(), { itemId: Number(match[1]), name });
  }
  return byName;
}

function tidyName(value) {
  const name = value.replace(/\s+/g, " ").replace(/\.$/, "").trim();
  if (!name || name.length > 48 || /\d{2,}/.test(name)) return "";
  return name;
}

function reagentFromPart(part, names, quantity) {
  const linked = /(?:item|currency)=(\d+)"[^>]*>([\s\S]*?)<\/a>/.exec(part);
  if (linked && part.includes("currency=")) return { itemId: 0, name: tidyName(plain(linked[2])), quantity };
  if (linked && part.includes("item=")) return { itemId: Number(linked[1]), name: tidyName(plain(linked[2])), quantity };
  const named = tidyName(plain(part).replace(/^\d+x\s*/, ""));
  if (!named) return null;
  const known = names.get(named.toLowerCase());
  return known ? { ...known, quantity } : { itemId: 0, name: named, quantity };
}

function reagentsFrom(fragment, names, craftCount) {
  const body = fragment.split(/\s-\s/).slice(1).join(" - ");
  if (!body) return [];
  const reagents = [];
  for (const part of body.split(",")) {
    const count = /(\d+)x/.exec(part);
    if (!count) continue;
    const quantity = Math.max(1, Math.round(Number(count[1]) / craftCount));
    const reagent = reagentFromPart(part, names, quantity);
    if (reagent?.name) reagents.push(reagent);
  }
  return reagents;
}

function reagentsPerCraft(cell, names) {
  const reagents = [];
  for (const match of cell.matchAll(/(\d+)x\s*(?:<a[^>]*(?:item|currency)=(\d+)"[^>]*>([\s\S]*?)<\/a>|[^<,]{2,48})/g)) {
    const quantity = Number(match[1]);
    if (match[2]) {
      const name = tidyName(plain(match[3]));
      if (!name) continue;
      reagents.push({ itemId: match[0].includes("currency=") ? 0 : Number(match[2]), name, quantity });
      continue;
    }
    const reagent = reagentFromPart(match[0], names, quantity);
    if (reagent?.name) reagents.push(reagent);
  }
  return reagents;
}

function bandFor(span, crafts) {
  const points = span.to - span.from;
  if (points <= 0 || crafts <= 0) return null;
  if (crafts <= points && points % crafts === 0) {
    return { skillPoints: points / crafts, flatChance: 1, yellowAt: span.to, greenAt: span.to, greyAt: span.to };
  }
  if (crafts < points) {
    return { skillPoints: 1, guideCrafts: crafts, flatChance: 1, yellowAt: span.to, greenAt: span.to, greyAt: span.to };
  }
  return { skillPoints: 1, flatChance: points / crafts, yellowAt: span.to, greenAt: span.to, greyAt: span.to };
}

function statedColors(text) {
  const orange = /orange to (\d+)/.exec(text);
  const yellow = /yellow to (\d+)/.exec(text);
  const grey = /grey at (\d+)/.exec(text);
  if (!orange && !yellow && !grey) return null;
  const yellowAt = orange ? Number(orange[1]) : Number(yellow?.[1] ?? grey?.[1]);
  const greenAt = yellow ? Number(yellow[1]) : yellowAt;
  const greyAt = grey ? Number(grey[1]) : greenAt;
  return { yellowAt, greenAt, greyAt, skillPoints: 1 };
}

function craftLines(fragment, names) {
  const lines = [];
  for (const chunk of fragment.matchAll(/<(p|li)>([\s\S]*?)<\/\1>/g)) {
    const spell = /~?(\d+)x\s*<a[^>]*href="https:\/\/www\.wowhead\.com\/spell=(\d+)"[^>]*>([\s\S]*?)<\/a>([\s\S]*)/.exec(chunk[2]);
    if (!spell) continue;
    const crafts = Number(spell[1]);
    const reagents = reagentsFrom(spell[4].split(/<(?:p|li|h\d|\/p|\/li)/)[0], names, crafts);
    if (reagents.length === 0 && !/recycle/i.test(plain(spell[3]))) continue;
    lines.push({ id: Number(spell[2]), name: plain(spell[3]), crafts, reagents, free: reagents.length === 0 });
  }
  return lines;
}

function tableLines(fragment, names) {
  const lines = [];
  for (const table of fragment.matchAll(/<table[\s\S]*?<\/table>/g)) {
    for (const row of table[0].matchAll(/<tr[\s\S]*?<\/tr>/g)) {
      const cells = [...row[0].matchAll(/<t[dh][\s\S]*?<\/t[dh]>/g)].map((cell) => cell[0]);
      if (cells.length < 2) continue;
      const spell = /<a[^>]*href="https:\/\/www\.wowhead\.com\/spell=(\d+)"[^>]*>([\s\S]*?)<\/a>/.exec(cells[0]);
      if (!spell) continue;
      const headerCount = /~\s*(\d+)x/.exec(plain(table[0].slice(0, 300)));
      const counted = /~?\s*(\d+)x/.exec(plain(cells[0]));
      const crafts = counted ? Number(counted[1]) : headerCount ? Number(headerCount[1]) : 1;
      const perCraft = reagentsPerCraft(cells[1], names);
      if (perCraft.length === 0) continue;
      const reagents = counted || headerCount ? perCraft.map((reagent) => ({ ...reagent, quantity: Math.max(1, Math.round(reagent.quantity / crafts)) })) : perCraft;
      lines.push({ id: Number(spell[1]), name: plain(spell[2]), crafts, reagents, fromTable: true, perCraft: !counted && !headerCount });
    }
  }
  return lines;
}

function sumReagents(lines) {
  const totals = new Map();
  for (const line of lines) {
    for (const reagent of line.reagents) {
      const key = `${reagent.itemId}:${reagent.name}`;
      const current = totals.get(key) ?? { ...reagent, quantity: 0 };
      current.quantity += reagent.quantity;
      totals.set(key, current);
    }
  }
  return [...totals.values()];
}

function recipesFrom(html, profession) {
  const names = itemNames(html);
  const recipes = [];
  let band = null;
  let notes = "";
  const sections = html.split(/<h([1-4])[^>]*>/g).slice(1);
  const pushRepeat = (line, span, heading, sectionNotes) => {
    if (!span || span.to <= span.from) return;
    const potion = /potion|transmute/i.test(heading) && /turning yellow at 80 and green at 90/.test(sectionNotes);
    const flask = /flask/i.test(heading) && /2 skill points per craft until 90/.test(sectionNotes);
    const base = { id: line.id, name: line.name, profession, reagents: line.reagents, free: line.free === true };
    if (potion) {
      recipes.push({ ...base, minSkill: span.from, yellowAt: 80, greenAt: 90, greyAt: 100, skillPoints: 1 });
      return;
    }
    if (flask) {
      if (span.from < 90) {
        recipes.push({ ...base, minSkill: span.from, yellowAt: 90, greenAt: 90, greyAt: 90, skillPoints: 2, flatChance: 1 });
      }
      if (span.to > 90) {
        recipes.push({ ...base, minSkill: Math.max(span.from, 90), yellowAt: 95, greenAt: 95, greyAt: 100, skillPoints: 1 });
      }
      return;
    }
    const colors = statedColors(sectionNotes);
    if (line.fromTable && line.perCraft) {
      recipes.push({
        ...base,
        minSkill: span.from,
        ...(colors ?? { yellowAt: span.to, greenAt: span.to, greyAt: span.to, skillPoints: 1, flatChance: 1, assumed: true }),
      });
      return;
    }
    if (colors && line.fromTable) {
      recipes.push({ ...base, minSkill: span.from, ...colors });
      return;
    }
    const pacing = bandFor(span, line.crafts);
    if (!pacing) return;
    recipes.push({ ...base, minSkill: span.from, ...pacing });
  };
  const pushLines = (lines, span, heading, sectionNotes) => {
    if (!span || lines.length === 0) return;
    const priced = lines.filter((line) => !line.free);
    const usable = priced.length > 0 ? priced : lines.filter((line) => line.free);
    const singles = usable.filter((line) => line.crafts === 1 && !line.fromTable);
    const repeats = usable.filter((line) => line.crafts > 1 || line.fromTable);
    let cursor = span.from;
    if (singles.length > 1) {
      for (const line of singles) {
        recipes.push({
          id: line.id,
          name: line.name,
          profession,
          concentrationOnly: true,
          minSkill: cursor,
          yellowAt: cursor + 1,
          greenAt: cursor + 1,
          greyAt: cursor + 1,
          skillPoints: 1,
          flatChance: 1,
          reagents: line.reagents,
        });
      }
      recipes.push({
        id: singles[0].id,
        name: singles.map((line) => line.name).join(", "),
        profession,
        once: true,
        minSkill: cursor,
        yellowAt: cursor + singles.length,
        greenAt: cursor + singles.length,
        greyAt: cursor + singles.length,
        skillPoints: singles.length,
        flatChance: 1,
        reagents: sumReagents(singles).filter((reagent) => reagent.itemId > 0 || !singles.some((line) => line.name.toLowerCase() === reagent.name.toLowerCase())),
      });
      cursor += singles.length;
    } else if (singles.length === 1) {
      recipes.push({
        id: singles[0].id,
        name: singles[0].name,
        profession,
        minSkill: cursor,
        yellowAt: cursor + 1,
        greenAt: cursor + 1,
        greyAt: cursor + 1,
        skillPoints: 1,
        flatChance: 1,
        reagents: singles[0].reagents,
      });
      cursor += 1;
    }
    const rest = { from: cursor, to: span.to };
    for (const line of repeats) pushRepeat(line, line.fromTable && singles.length === 0 ? span : rest, heading, sectionNotes);
  };
  for (let index = 0; index < sections.length; index += 2) {
    const level = sections[index];
    const section = sections[index + 1] ?? "";
    const close = section.search(/<\/h[1-4]>/);
    const heading = plain(section.slice(0, close));
    if (level === "2") notes = plain(section.slice(close)).slice(0, 1600);
    if (/shopping list|table of contents/i.test(heading)) continue;
    const range = /(\d+)\s*-\s*(\d+)/.exec(heading);
    if (range) band = { from: Number(range[1]), to: Number(range[2]) };
    const sectionNotes = `${notes} ${plain(section.slice(close)).slice(0, 1600)}`;
    const blocks = section.split(/<b>\s*(\d+)\s*-\s*(\d+)\s*<\/b>/g);
    const consume = (fragment, stepBand) => {
      const span = stepBand ?? band;
      const lines = [...craftLines(fragment, names), ...tableLines(fragment, names)];
      pushLines(lines, span, heading, sectionNotes);
    };
    if (blocks.length === 1) {
      consume(section, null);
      continue;
    }
    consume(blocks[0], null);
    for (let block = 1; block < blocks.length; block += 3) {
      consume(blocks[block + 2] ?? "", { from: Number(blocks[block]), to: Number(blocks[block + 1]) });
    }
  }
  const seen = new Set();
  return recipes.filter((recipe) => {
    const key = `${recipe.id}:${recipe.minSkill}:${recipe.greyAt}:${recipe.name}`;
    if (seen.has(key) || recipe.greyAt <= recipe.minSkill) return false;
    seen.add(key);
    return true;
  });
}

function firstCraftStep(html, profession, recipes, shopping) {
  const skipped = /didn.t include (\d+)\s*-\s*\d+/i.exec(plain(html));
  if (!skipped || shopping.length === 0) return recipes;
  const coverTo = Number(skipped[1]);
  if (recipes.some((recipe) => recipe.minSkill < coverTo)) return recipes;
  return [
    {
      id: 0,
      name: "First-craft every trainer recipe",
      profession,
      once: true,
      minSkill: 1,
      yellowAt: coverTo,
      greenAt: coverTo,
      greyAt: coverTo,
      skillPoints: coverTo - 1,
      flatChance: 1,
      reagents: shopping,
    },
    ...recipes,
  ];
}

function shoppingFrom(html) {
  const start = html.indexOf("Shopping List");
  if (start < 0) return [];
  const list = html.slice(start, start + 8000);
  const end = list.indexOf("<h2");
  const chunk = end > 0 ? list.slice(0, end) : list;
  const items = [];
  for (const match of chunk.matchAll(/<li>\s*(\d+)x\s*<a[^>]*item=(\d+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    items.push({ itemId: Number(match[2]), name: plain(match[3]), quantity: Number(match[1]) });
  }
  return items;
}

async function outputItem(spellId, reagentIds) {
  const response = await fetch(`https://nether.wowhead.com/tooltip/spell/${spellId}`, {
    headers: { "user-agent": "Mozilla/5.0" },
  });
  if (!response.ok) return null;
  const text = await response.text();
  const ignored = new Set([...reagentIds, 118722]);
  const ids = [...text.matchAll(/item=(\d+)/g)].map((match) => Number(match[1]));
  for (let index = ids.length - 1; index >= 0; index -= 1) {
    if (!ignored.has(ids[index])) return ids[index];
  }
  return null;
}

const routes = {};
for (const [profession, url] of GUIDE_URLS) {
  const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!response.ok) {
    console.error(profession, response.status);
    continue;
  }
  const html = await response.text();
  const shopping = shoppingFrom(html);
  const recipes = firstCraftStep(html, profession, recipesFrom(html, profession), shopping);
  console.error(profession, recipes.length, "shopping", shopping.length);
  routes[profession] = { recipes, shopping };
}

const knownItems = new Map();
try {
  const previous = JSON.parse(readFileSync(new URL("../src/data/levelling.json", import.meta.url), "utf8"));
  for (const route of Object.values(previous)) {
    for (const recipe of route.recipes ?? []) {
      if (recipe.id > 0 && recipe.itemId) knownItems.set(recipe.id, recipe.itemId);
    }
  }
} catch {
  // The catalogue is created on the first run.
}
const pending = [];
for (const { recipes } of Object.values(routes)) {
  for (const recipe of recipes) {
    if (recipe.itemId == null && knownItems.has(recipe.id)) recipe.itemId = knownItems.get(recipe.id);
    if (recipe.itemId == null && recipe.id > 0 && !recipe.free && !recipe.once) pending.push(recipe);
  }
}
for (let index = 0; index < pending.length; index += 3) {
  const batch = pending.slice(index, index + 3);
  await Promise.all(
    batch.map(async (recipe) => {
      recipe.itemId = await outputItem(
        recipe.id,
        recipe.reagents.map((reagent) => reagent.itemId),
      );
    }),
  );
  await new Promise((resolve) => setTimeout(resolve, 250));
}

for (const route of Object.values(routes)) {
  const crafted = new Map();
  for (const recipe of route.recipes) {
    if (recipe.itemId > 0 && !recipe.name.includes(",")) crafted.set(recipe.name.toLowerCase(), recipe.itemId);
  }
  for (const recipe of route.recipes) {
    for (const reagent of recipe.reagents) {
      if (reagent.itemId > 0) continue;
      const itemId = crafted.get(reagent.name.toLowerCase());
      if (itemId) reagent.itemId = itemId;
    }
  }
}

writeFileSync(new URL("../src/data/levelling.json", import.meta.url), `${JSON.stringify(routes, null, 2)}\n`);
for (const [profession, route] of Object.entries(routes)) {
  console.log(`\n${profession} ${route.recipes.length}`);
  for (const recipe of route.recipes) {
    console.log(
      `  ${recipe.minSkill}-${recipe.greyAt} x${recipe.skillPoints} ${(recipe.flatChance * 100).toFixed(0)}% ${recipe.name} item ${recipe.itemId ?? "?"} | ${recipe.reagents.map((reagent) => `${reagent.quantity} ${reagent.name}`).join(", ")}`,
    );
  }
}
