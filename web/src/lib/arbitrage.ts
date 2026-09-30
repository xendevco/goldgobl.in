import { yieldCoefficients } from "@/lib/yield";

export function arbitrageSpread(homePrice: number, remotePrice: number, cut = yieldCoefficients.auctionHouseCut): number {
  return remotePrice - homePrice - remotePrice * cut;
}

export type SpreadRow = {
  itemId: number;
  name: string;
  homePrice: number;
  remotePrice: number;
  remoteRealm: string;
  spread: number;
};

export function rankSpreads(rows: SpreadRow[]): SpreadRow[] {
  return [...rows].sort((a, b) => b.spread - a.spread || a.name.localeCompare(b.name));
}
