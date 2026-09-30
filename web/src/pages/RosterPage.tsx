import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatToken } from "@/lib/format";
import { optimiseRoster } from "@/lib/roster";
import { useRoster } from "@/stores/roster";

const PRESETS = [4, 8, 12, 20];

export function RosterPage() {
  const characters = useRoster((state) => state.characters);
  const capacity = useRoster((state) => state.settings.targetCapacity);
  const setTargetCapacity = useRoster((state) => state.setTargetCapacity);
  const assignments = optimiseRoster(characters, capacity);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Crafting syndicate</h1>
          <p className="text-muted-foreground text-xs">
            {characters.length} imported character{characters.length === 1 ? "" : "s"}. Target {capacity} crafters.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((preset) => (
            <Button key={preset} size="sm" variant={capacity === preset ? "default" : "outline"} onClick={() => setTargetCapacity(preset)}>
              {preset}
            </Button>
          ))}
          <label className="text-muted-foreground flex items-center gap-2 text-xs">
            Custom
            <Input
              aria-label="Custom crafter capacity"
              className="h-8 w-16"
              type="number"
              min={1}
              max={50}
              value={capacity}
              onChange={(event) => setTargetCapacity(Number(event.target.value))}
            />
          </label>
        </div>
      </div>

      {characters.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-md border border-dashed p-6 text-sm">
          Import a GG1 export to build the assignment sheet. Empty seats are filled with recommended races until the target capacity is met.
        </p>
      ) : null}

      <div className="border-border overflow-hidden rounded-md border">
        <Table className="min-w-[42rem]">
          <TableHeader>
            <TableRow>
              <TableHead>Character</TableHead>
              <TableHead>Race</TableHead>
              <TableHead>Profession</TableHead>
              <TableHead>Tags</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.flatMap((seat) =>
              seat.professions.map((profession) => (
                <TableRow key={`${seat.name}-${profession.profession}`}>
                  <TableCell className="py-1.5">
                    <div className="font-medium">{seat.name}</div>
                    <div className="text-muted-foreground text-[11px]">
                      {seat.isNew ? "Recommended seat" : `${formatToken(seat.className)} · ${seat.realm}`}
                    </div>
                  </TableCell>
                  <TableCell className="py-1.5">{formatToken(seat.race)}</TableCell>
                  <TableCell className="py-1.5">{profession.profession}</TableCell>
                  <TableCell className="py-1.5">
                    <div className="flex flex-wrap gap-1">
                      {profession.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant={tag === "Keep" || tag === "Cooldown Ready" ? "secondary" : "outline"}
                          className="h-auto overflow-visible whitespace-normal"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              )),
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
