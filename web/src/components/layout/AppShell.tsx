import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { ImportDialog } from "@/components/ImportDialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getHealth } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useRoster } from "@/stores/roster";
import type { Region } from "@/types/character";

const LINKS = [
  { to: "/", label: "Roster" },
  { to: "/profits", label: "Profits" },
  { to: "/decor", label: "Decor" },
  { to: "/arbitrage", label: "Arbitrage" },
  { to: "/levelling", label: "Levelling" },
];

const REGIONS: Region[] = ["eu", "us", "kr", "tw"];

function HealthPill() {
  const [label, setLabel] = useState("Checking API");

  useEffect(() => {
    let cancelled = false;
    getHealth()
      .then((health) => {
        if (!cancelled) setLabel(health.ok ? `API ${health.tier}` : "API down");
      })
      .catch(() => {
        if (!cancelled) setLabel("API unreachable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <Badge variant="outline">{label}</Badge>;
}

export function AppShell() {
  const region = useRoster((state) => state.settings.region);
  const setRegion = useRoster((state) => state.setRegion);

  return (
    <div className="bg-background min-h-svh">
      <header className="border-border bg-card/80 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2">
          <div className="mr-2">
            <p className="text-sm font-semibold tracking-tight">GoldGobl.in</p>
            <p className="text-muted-foreground text-[11px]">Midnight season 2</p>
          </div>
          <nav className="flex flex-wrap gap-1">
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-2 py-1 text-xs",
                    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <HealthPill />
            <Select value={region} onValueChange={(value) => setRegion(value as Region)}>
              <SelectTrigger size="sm" aria-label="Region" className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGIONS.map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {entry.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ImportDialog />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-4">
        <Outlet />
      </main>
    </div>
  );
}
