import Ajv from "ajv";
import { deflateRaw, inflateRaw } from "pako";
import schema from "../../../shared/payload.schema.json" with { type: "json" };
import type { Character, ExportPayload } from "@/types/character";

const PREFIX = "GG1:";
const ajv = new Ajv({ allErrors: true, strict: false });
const { $schema: _schema, ...schemaBody } = schema;
const validate = ajv.compile(schemaBody);

export function characterKey(character: Pick<Character, "name" | "realm">): string {
  return `${character.name.trim().toLowerCase()}|${character.realm.trim().toLowerCase()}`;
}

export function encodeExport(payload: ExportPayload): string {
  const json = JSON.stringify(payload);
  const compressed = deflateRaw(new TextEncoder().encode(json));
  return PREFIX + bytesToBase64(compressed);
}

export function decodeExport(raw: string): ExportPayload {
  const trimmed = raw.trim();
  if (!trimmed.startsWith(PREFIX)) {
    throw new Error("Export must start with GG1:.");
  }
  let inflated: string;
  try {
    const bytes = base64ToBytes(trimmed.slice(PREFIX.length));
    inflated = new TextDecoder().decode(inflateRaw(bytes));
  } catch {
    throw new Error("Could not decompress that export. Copy the whole GG1 string.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(inflated);
  } catch {
    throw new Error("Export JSON is not valid.");
  }
  if (!validate(parsed)) {
    throw new Error(formatErrors());
  }
  return parsed as ExportPayload;
}

function formatErrors(): string {
  const details = (validate.errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`);
  return details.length ? `Export does not match the schema: ${details.join("; ")}` : "Export does not match the schema.";
}

export function mergeCharacters(current: Character[], incoming: Character[]): Character[] {
  const next = new Map(current.map((character) => [characterKey(character), character]));
  for (const character of incoming) next.set(characterKey(character), character);
  return [...next.values()].sort((a, b) => a.name.localeCompare(b.name) || a.realm.localeCompare(b.realm));
}

export function importRoster(
  current: Character[],
  raw: string,
  mode: "merge" | "replace",
): { characters: Character[]; importedAt: number; error: string | null } {
  try {
    const payload = decodeExport(raw);
    const characters = mode === "replace" ? payload.characters : mergeCharacters(current, payload.characters);
    return { characters, importedAt: payload.exportedAt, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not import that export.";
    return { characters: current, importedAt: 0, error: message };
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
