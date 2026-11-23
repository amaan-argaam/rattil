import { File, Paths } from "expo-file-system";
import { useSyncExternalStore } from "react";

export interface Settings {
  night: boolean;
  page: number;
  /** Tilawa model tier: "lite" (25 MB, default on phones) or "full" (68 MB, more accurate). */
  tier: "lite" | "full";
  /** Turn pages automatically while reciting. */
  follow: boolean;
}

const DEFAULTS: Settings = { night: false, page: 1, tier: "lite", follow: true };
const file = new File(Paths.document, "settings.json");

let current: Settings = DEFAULTS;
try {
  if (file.exists) current = { ...DEFAULTS, ...JSON.parse(file.textSync()) };
} catch {
  current = DEFAULTS;
}

const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function getSettings() {
  return current;
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  listeners.forEach((l) => l());
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      file.write(JSON.stringify(current));
    } catch {
      // Settings are a convenience; a failed write must never break reading.
    }
  }, 400);
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => current,
  );
}
