import { decorItems } from "@/data/decor";

/** Non-stackable Midnight housing decor that can move through the warbank before it is used. */
export const arbitrageWatchlist = decorItems.map((item) => ({
  itemId: item.itemId,
  name: item.name,
}));
