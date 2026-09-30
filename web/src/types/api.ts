import type { Region } from "@/types/character";

export type PriceSource = "blizzard" | "tsm" | "cache" | "fixture";

export type PriceQuote = {
  itemId: number;
  marketValue: number | null;
  saleRate: number | null;
  updatedAt: string;
  source: PriceSource;
};

export type HealthResponse = {
  ok: boolean;
  tier: "free" | "premium";
  service: string;
};

export type Realm = {
  id: number;
  name: string;
  region: Region;
};

export type PriceResponse = {
  region: Region;
  connectedRealmId: number | null;
  quotes: PriceQuote[];
};
