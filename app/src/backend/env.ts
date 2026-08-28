import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function unquoteEnvValue(value: string) {
  const trimmed = value.trim();
  const quote = trimmed[0];
  if ((quote === '"' || quote === "'") && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadDotEnvFile(path: string) {
  if (!existsSync(path)) return;

  const contents = readFileSync(path, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const normalized = trimmed.startsWith("export ") ? trimmed.slice(7).trimStart() : trimmed;
    const equalsAt = normalized.indexOf("=");
    if (equalsAt <= 0) continue;

    const key = normalized.slice(0, equalsAt).trim();
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) || process.env[key] !== undefined) continue;

    process.env[key] = unquoteEnvValue(normalized.slice(equalsAt + 1));
  }
}

loadDotEnvFile(join(process.cwd(), ".env"));
loadDotEnvFile(join(process.cwd(), ".env.local"));

export function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function optionalEnv(name: string, fallback = "") {
  return process.env[name] ?? fallback;
}

export function parseCsvEnv(name: string): Set<string> {
  const raw = process.env[name];
  if (!raw) return new Set();
  return new Set(raw.split(",").map((part) => part.trim()).filter(Boolean));
}
