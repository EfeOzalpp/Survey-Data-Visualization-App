import { readFile } from "node:fs/promises";
import { join } from "node:path";

interface ManifestEntry {
    file?: string;
    css?: string[];
    imports?: string[];
}

type ViteManifest = Record<string, ManifestEntry | undefined>;

interface ClientEntryAssets {
    script: string;
    stylesheets: string[];
}

let cachedManifest: ViteManifest | null = null;

async function readManifest(clientDist: string) {
   if (process.env.NODE_ENV == "production" && cachedManifest)  {
    return cachedManifest;
   } 

   const manifestPath = join(clientDist, ".vite", "manifest.json");
   const raw = await readFile(manifestPath, "utf8");
   const manifest = JSON.parse(raw) as ViteManifest;

   if (process.env.NODE_ENV === "production") {
    cachedManifest = manifest;
   }

   return manifest;
}

function toPublicPath(file: string) {
    return `/${file}`;
}

// collectCss reads the parsed Vite manifest object.
// it starts from one manifest entry.
// It collects CSS files attached to that entry.
// Find every CSS file needed by this entry, including CSS attached to imported JS chunks.
function collectCss(
  manifest: ViteManifest,
  entry: ManifestEntry,
  seenCss = new Set<string>(),
  seenEntries = new Set<string>()
): string[] {
  const stylesheets: string[] = [];

  for (const cssFile of entry.css ?? []) {
    if (!seenCss.has(cssFile)) {
      seenCss.add(cssFile);
      stylesheets.push(toPublicPath(cssFile));
    }
  }

  for (const importedKey of entry.imports ?? []) {
    if (seenEntries.has(importedKey)) continue;
    seenEntries.add(importedKey);

    const importedEntry = manifest[importedKey];
    if (!importedEntry) continue;

    stylesheets.push(...collectCss(manifest, importedEntry, seenCss, seenEntries));
  }

  return stylesheets;
}

export async function readClientEntryAssets(
    clientDist: string,
    entryKey = "index.html"
): Promise<ClientEntryAssets> {
    const manifest = await readManifest(clientDist);
    const entry = manifest[entryKey];

    if (!entry?.file) {
        throw new Error (`Missing Vite manifest entry for ${entryKey}`);    
    }

    return {
        script: toPublicPath(entry.file),
        stylesheets: collectCss(manifest, entry),
    };
}