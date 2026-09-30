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

export function expectedNet(input: CraftYieldInput): number {
  const revenue =
    input.sellPrice *
    input.saleRate *
    expectedYield(input.multicraftChance) *
    (1 - yieldCoefficients.auctionHouseCut);
  return revenue - expectedReagentCost(input);
}

export function reagentCost(
  reagents: { itemId: number; quantity: number }[],
  prices: Map<number, number | null>,
): number | null {
  let total = 0;
  for (const reagent of reagents) {
    const price = prices.get(reagent.itemId);
    if (price == null) return null;
    total += price * reagent.quantity;
  }
  return total;
}
