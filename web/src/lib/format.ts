export function formatCopper(copper: number | null | undefined): string {
  if (copper == null || Number.isNaN(copper)) return "n/a";
  const sign = copper < 0 ? "-" : "";
  const absolute = Math.abs(Math.round(copper));
  const gold = Math.floor(absolute / 10000);
  const silver = Math.floor((absolute % 10000) / 100);
  const remainder = absolute % 100;
  return `${sign}${gold}g ${silver}s ${remainder}c`;
}

export function formatToken(token: string): string {
  if (!token) return "";
  if (token.includes(" ")) return token;
  if (token === token.toUpperCase()) {
    return token.charAt(0) + token.slice(1).toLowerCase();
  }
  const spaced = token.replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}
