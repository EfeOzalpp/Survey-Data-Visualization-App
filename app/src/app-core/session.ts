// Session stored information
import type { Mode } from "./state/ui-store";

const LOCAL_BACKED_KEYS = new Set([
  "be.myEntryId",
  "be.mySection",
  "be.myRole",
  "be.myAvg",
  "be.myDoc",
  "be.myEditToken",
  "be.justSubmitted",
  "be.openPersonalOnNext",
]);

function readStorage(storage: Storage | undefined, key: string): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage: Storage | undefined, key: string, value: string) {
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch {
    return;
  }
}

function removeStorage(storage: Storage | undefined, key: string) {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    return;
  }
}

export function getSessionItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  return readStorage(window.sessionStorage, key) ??
    (LOCAL_BACKED_KEYS.has(key) ? readStorage(window.localStorage, key) : null);
}

export function setSessionItem(key: string, value: string) {
  if (typeof window === "undefined") return;
  writeStorage(window.sessionStorage, key, value);
  if (LOCAL_BACKED_KEYS.has(key)) writeStorage(window.localStorage, key, value);
}

export function removeSessionItems(keys: string[]) {
  if (typeof window === "undefined") return;
  for (const key of keys) {
    removeStorage(window.sessionStorage, key);
    if (LOCAL_BACKED_KEYS.has(key)) removeStorage(window.localStorage, key);
  }
}

export function readStoredMode(defaultMode: Mode): Mode {
  const saved = getSessionItem("be.mode");
  return saved === "absolute" || saved === "relative" ? saved : defaultMode;
}

export function readStoredDarkMode(defaultValue = false): boolean {
  const saved = getSessionItem("be.darkMode");
  if (saved == null) return defaultValue;
  return saved === "true";
}

export function applyThemeToDocument(darkMode: boolean) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.add("theme-switching");
  void root.offsetWidth;
  root.dataset.theme = darkMode ? "dark" : "light";
  root.classList.toggle("dark", darkMode);
  window.requestAnimationFrame(() => {
    root.classList.remove("theme-switching");
  });

  const color = darkMode ? "#21201e" : "#f8f3ef";
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(m => {
    m.content = color;
  });
}
