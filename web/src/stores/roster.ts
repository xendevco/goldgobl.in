import { create } from "zustand";
import { persist } from "zustand/middleware";
import { importRoster } from "@/lib/import";
import type { Character, Region } from "@/types/character";

export type RosterSettings = {
  region: Region;
  targetCapacity: number;
  homeRealmId: number | null;
  watchRealmIds: number[];
  multicraftChance: number;
  resourcefulnessChance: number;
  ingenuityChance: number;
};

type RosterState = {
  characters: Character[];
  importedAt: number | null;
  settings: RosterSettings;
  importError: string | null;
  mergeExport: (raw: string) => void;
  replaceExport: (raw: string) => void;
  clearImportError: () => void;
  setRegion: (region: Region) => void;
  setTargetCapacity: (capacity: number) => void;
  setHomeRealmId: (realmId: number) => void;
  toggleWatchRealm: (realmId: number) => void;
  setWatchRealmIds: (realmIds: number[]) => void;
  setCraftStat: (stat: "multicraftChance" | "resourcefulnessChance" | "ingenuityChance", value: number) => void;
};

const defaultSettings: RosterSettings = {
  region: "eu",
  targetCapacity: 8,
  homeRealmId: null,
  watchRealmIds: [],
  multicraftChance: 0.2,
  resourcefulnessChance: 0.2,
  ingenuityChance: 0.1,
};

export const useRoster = create<RosterState>()(
  persist(
    (set) => ({
      characters: [],
      importedAt: null,
      settings: defaultSettings,
      importError: null,
      mergeExport: (raw) =>
        set((state) => {
          const result = importRoster(state.characters, raw, "merge");
          if (result.error) return { importError: result.error };
          return { characters: result.characters, importedAt: result.importedAt, importError: null };
        }),
      replaceExport: (raw) =>
        set((state) => {
          const result = importRoster(state.characters, raw, "replace");
          if (result.error) return { importError: result.error };
          return { characters: result.characters, importedAt: result.importedAt, importError: null };
        }),
      clearImportError: () => set({ importError: null }),
      setRegion: (region) => set((state) => ({ settings: { ...state.settings, region } })),
      setTargetCapacity: (targetCapacity) =>
        set((state) => ({ settings: { ...state.settings, targetCapacity: Math.max(1, Math.min(50, targetCapacity)) } })),
      setHomeRealmId: (homeRealmId) =>
        set((state) => ({
          settings: {
            ...state.settings,
            homeRealmId,
            watchRealmIds: state.settings.watchRealmIds.filter((id) => id !== homeRealmId),
          },
        })),
      toggleWatchRealm: (realmId) =>
        set((state) => {
          const watchRealmIds = state.settings.watchRealmIds.includes(realmId)
            ? state.settings.watchRealmIds.filter((id) => id !== realmId)
            : [...state.settings.watchRealmIds, realmId];
          return { settings: { ...state.settings, watchRealmIds } };
        }),
      setWatchRealmIds: (watchRealmIds) => set((state) => ({ settings: { ...state.settings, watchRealmIds } })),
      setCraftStat: (stat, value) =>
        set((state) => ({
          settings: { ...state.settings, [stat]: Math.max(0, Math.min(1, value)) },
        })),
    }),
    {
      name: "goldgoblin-roster",
      partialize: (state) => ({
        characters: state.characters,
        importedAt: state.importedAt,
        settings: state.settings,
      }),
    },
  ),
);
