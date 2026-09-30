import { formatRefreshed } from "@/lib/format";

export function PriceStamp({ asOf, stale }: { asOf: string | null; stale: boolean }) {
  const label = formatRefreshed(asOf, stale);
  if (!label) return null;
  return <span className="text-muted-foreground text-xs">{label}</span>;
}
