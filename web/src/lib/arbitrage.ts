import { yieldCoefficients } from "@/lib/yield";

export function arbitrageSpread(homePrice: number, remotePrice: number, cut = yieldCoefficients.auctionHouseCut): number {
  return remotePrice - homePrice - remotePrice * cut;
}

export function expectedArbitrage(
  homePrice: number,
  remotePrice: number,
  saleRate: number | null,
  cut = yieldCoefficients.auctionHouseCut,
): number | null {
  if (saleRate == null) return null;
  return remotePrice * (1 - cut) * saleRate - homePrice;
}

export type SpreadRow = {
  itemId: number;
  name: string;
  homePrice: number;
  remotePrice: number;
  remoteRealm: string;
  spread: number;
  saleRate: number | null;
  soldPerDay: number | null;
  expected: number | null;
};

export function rankSpreads(rows: SpreadRow[]): SpreadRow[] {
  return [...rows].sort(
    (a, b) =>
      (b.expected ?? Number.NEGATIVE_INFINITY) - (a.expected ?? Number.NEGATIVE_INFINITY) ||
      b.spread - a.spread ||
      a.name.localeCompare(b.name),
  );
}
