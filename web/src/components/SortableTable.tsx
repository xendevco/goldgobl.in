import { useState, type ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Column<T> = {
  key: string;
  header: string;
  align?: "left" | "right";
  sortValue: (row: T) => string | number;
  cell: (row: T) => ReactNode;
};

export function SortableTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  initialKey,
  initialDirection = "asc",
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  caption?: string;
  initialKey?: string;
  initialDirection?: "asc" | "desc";
}) {
  const [sortKey, setSortKey] = useState(initialKey ?? columns[0]?.key ?? "");
  const [direction, setDirection] = useState<"asc" | "desc">(initialDirection);
  const active = columns.find((column) => column.key === sortKey) ?? columns[0];

  const sorted = [...rows].sort((left, right) => {
    if (!active) return 0;
    const a = active.sortValue(left);
    const b = active.sortValue(right);
    const compared = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
    return direction === "asc" ? compared : -compared;
  });

  return (
    <Table className="min-w-[42rem]">
      {caption ? <caption className="mb-2 caption-top text-left text-xs text-muted-foreground">{caption}</caption> : null}
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.key} className={column.align === "right" ? "text-right" : "text-left"}>
              <button
                type="button"
                className="font-medium"
                onClick={() => {
                  if (sortKey === column.key) setDirection((current) => (current === "asc" ? "desc" : "asc"));
                  else {
                    setSortKey(column.key);
                    setDirection(rows[0] != null && typeof column.sortValue(rows[0]) === "number" ? "desc" : "asc");
                  }
                }}
              >
                {column.header}
                {sortKey === column.key ? (direction === "asc" ? " ↑" : " ↓") : ""}
              </button>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((row) => (
          <TableRow key={rowKey(row)}>
            {columns.map((column) => (
              <TableCell key={column.key} className={cn("py-1.5", column.align === "right" && "text-right tabular-nums")}>
                {column.cell(row)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
