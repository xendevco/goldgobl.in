import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import type { Realm } from "@/types/api";

type RealmPickerProps = {
  realms: Realm[];
  value: number | null;
  onChange: (realmId: number) => void;
  label?: string;
};

export function RealmPicker({ realms, value, onChange, label = "Home realm" }: RealmPickerProps) {
  const selected = realms.find((realm) => realm.id === value) ?? null;
  const [query, setQuery] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) setQuery(selected?.name ?? "");
  }, [open, selected?.name]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const showingCurrent = needle.length === 0 || needle === (selected?.name ?? "").toLowerCase();
    if (showingCurrent) return realms;
    return realms.filter((realm) => realm.name.toLowerCase().includes(needle));
  }, [query, realms, selected?.name]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function choose(realm: Realm) {
    onChange(realm.id);
    setQuery(realm.name);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActive((index) => Math.min(index + 1, Math.max(matches.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      const realm = matches[active];
      if (realm) choose(realm);
    } else if (event.key === "Escape") {
      setOpen(false);
      setQuery(selected?.name ?? "");
    }
  }

  return (
    <div className="relative w-64">
      <Input
        aria-label={label}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder="Type a realm"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={(event) => {
          setOpen(true);
          event.currentTarget.select();
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="border-border bg-popover absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border p-1 shadow-md"
        >
          {matches.length === 0 ? (
            <li className="text-muted-foreground px-2 py-1.5 text-xs">No realms match</li>
          ) : (
            matches.map((realm, index) => (
              <li key={realm.id} role="option" aria-selected={realm.id === value}>
                <button
                  ref={index === active ? activeRef : undefined}
                  type="button"
                  className={`w-full rounded-sm px-2 py-1.5 text-left text-xs ${index === active ? "bg-muted" : ""}`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(realm);
                  }}
                  onMouseEnter={() => setActive(index)}
                >
                  {realm.name}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
