export const yieldCoefficients = {
  auctionHouseCut: 0.05,
  multicraftExtraItems: 1,
  resourcefulnessRefundFraction: 0.3,
  ingenuitySaveFraction: 0.15,
};

export type CraftYieldInput = {
  reagentCost: number;
  sellPrice: number;
  saleRate: number;
  multicraftChance: number;
  resourcefulnessChance: number;
  ingenuityChance: number;
};

export function expectedYield(multicraftChance: number): number {
  return 1 + multicraftChance * yieldCoefficients.multicraftExtraItems;
}

export function expectedReagentCost(input: Pick<CraftYieldInput, "reagentCost" | "resourcefulnessChance" | "ingenuityChance">): number {
  const afterResourcefulness = 1 - input.resourcefulnessChance * yieldCoefficients.resourcefulnessRefundFraction;
  const afterIngenuity = 1 - input.ingenuityChance * yieldCoefficients.ingenuitySaveFraction;
  return input.reagentCost * afterResourcefulness * afterIngenuity;
}

export function expectedRevenue(input: Omit<CraftYieldInput, "reagentCost">): number {
  return input.sellPrice * input.saleRate * expectedYield(input.multicraftChance) * (1 - yieldCoefficients.auctionHouseCut);
}

export function expectedNet(input: CraftYieldInput): number {
  return expectedRevenue(input) - expectedReagentCost(input);
}

export function reagentCost(
  reagents: { itemId: number; quantity: number }[],
  prices: Map<number, number | null>,
): number | null {
  const partial = partialReagentCost(reagents, prices);
  return partial.missing.length === 0 ? partial.total : null;
}

export function cheapestSlotCost(
  slots: { quantity: number; options: { itemId: number; name: string }[] }[],
  prices: Map<number, number | null>,
): { total: number; missing: string[] } {
  let total = 0;
  const missing: string[] = [];
  for (const slot of slots) {
    let cheapest: number | null = null;
    for (const option of slot.options) {
      const price = prices.get(option.itemId);
      if (price == null) continue;
      const cost = price * slot.quantity;
      if (cheapest == null || cost < cheapest) cheapest = cost;
    }
    if (cheapest == null) missing.push(slot.options.map((option) => option.name).join(" / "));
    else total += cheapest;
  }
  return { total, missing };
}

export function partialReagentCost(
  reagents: { itemId: number; name?: string; quantity: number }[],
  prices: Map<number, number | null>,
): { total: number; missing: string[] } {
  let total = 0;
  const missing: string[] = [];
  for (const reagent of reagents) {
    const price = prices.get(reagent.itemId);
    if (price == null) missing.push(reagent.name ?? String(reagent.itemId));
    else total += price * reagent.quantity;
  }
  return { total, missing };
}
