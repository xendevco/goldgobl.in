import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useRoster } from "@/stores/roster";

export function ImportDialog() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const importError = useRoster((state) => state.importError);
  const mergeExport = useRoster((state) => state.mergeExport);
  const replaceExport = useRoster((state) => state.replaceExport);
  const clearImportError = useRoster((state) => state.clearImportError);

  const closeIfClean = () => {
    if (!useRoster.getState().importError) {
      setText("");
      setOpen(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) clearImportError();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">Import roster</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import GoldGoblin export</DialogTitle>
          <DialogDescription>
            Paste the GG1 string from the addon. Merge updates matching characters. Replace overwrites the roster.
          </DialogDescription>
        </DialogHeader>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          spellCheck={false}
          aria-label="GG1 export string"
          className="border-input bg-input/30 h-40 w-full resize-y rounded-md border p-2 font-mono text-xs"
          placeholder="GG1:..."
        />
        {importError ? <p className="text-destructive text-xs">{importError}</p> : null}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              replaceExport(text);
              closeIfClean();
            }}
          >
            Replace roster
          </Button>
          <Button
            onClick={() => {
              mergeExport(text);
              closeIfClean();
            }}
          >
            Merge into roster
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
