/**
 * Tilawa's model and Quran reference, downloaded once from Tilawa's official asset host (https://tilawa.dev/v1/,
 * the SDK's default `assetBase`) and kept in the app's documents directory. Every file is checked against the
 * size and sha256 pinned in the SDK's bundled registry before it is used.
 */
import { DEFAULTS, MODEL_REGISTRY, REFERENCE } from "@tilawa/core";
import type { ModelTier, TierName } from "@tilawa/core";
import { Directory, File, Paths } from "expo-file-system";

export const ASSET_BASE = DEFAULTS.assetBase; // https://tilawa.dev/v1/

const dir = new Directory(Paths.document, "tilawa");

export interface AssetSpec {
  key: string;
  url: string;
  bytes: number;
  sha256: string;
  file: File;
}

export function tierSpec(tier: TierName): AssetSpec & { tier: ModelTier } {
  const t = MODEL_REGISTRY.tiers.find((x) => x.tier === tier);
  if (!t) throw new Error(`No ${tier} tier in Tilawa's registry`);
  const key = `${t.id}@${t.version}`;
  return {
    key,
    tier: t,
    url: ASSET_BASE + t.base + t.manifest.file,
    bytes: t.bytes,
    sha256: t.sha256,
    file: new File(dir, `${key.replace(/[^a-z0-9.@-]/gi, "_")}.onnx`),
  };
}

export const referenceSpec = (): AssetSpec => ({
  key: REFERENCE.version,
  url: ASSET_BASE + REFERENCE.path,
  bytes: REFERENCE.bytes,
  sha256: REFERENCE.sha256,
  file: new File(dir, `${REFERENCE.version}.json`),
});

const verifiedMark = (a: AssetSpec) => new File(dir, `${a.file.name}.${a.sha256.slice(0, 16)}.ok`);

export function isReady(a: AssetSpec): boolean {
  return a.file.exists && a.file.size === a.bytes && verifiedMark(a).exists;
}

/** Downloads (if needed) and verifies one asset. `onProgress` gets bytes written so far. */
export async function ensureAsset(a: AssetSpec, onProgress?: (loaded: number, total: number) => void, signal?: AbortSignal): Promise<File> {
  if (isReady(a)) {
    onProgress?.(a.bytes, a.bytes);
    return a.file;
  }
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const part = new File(dir, `${a.file.name}.part`);
  if (part.exists) part.delete();
  const task = File.createDownloadTask(a.url, part, {
    onProgress: ({ bytesWritten }) => onProgress?.(Math.min(bytesWritten, a.bytes), a.bytes),
    signal,
  });
  await task.downloadAsync();
  if (part.size !== a.bytes) {
    part.delete();
    throw new Error(`Download of ${a.key} was ${part.size} bytes, expected ${a.bytes}`);
  }
  const digest = (await part.digest("SHA-256")).toLowerCase();
  if (digest !== a.sha256) {
    part.delete();
    throw new Error(`Checksum mismatch for ${a.key}`);
  }
  if (a.file.exists) a.file.delete();
  part.moveSync(a.file);
  verifiedMark(a).create({ overwrite: true });
  onProgress?.(a.bytes, a.bytes);
  return a.file;
}

/** Removes model files of the tier not in use, so only one model occupies storage. */
export function removeOtherTiers(keep: TierName) {
  for (const t of ["lite", "full"] as const) {
    if (t === keep) continue;
    const spec = tierSpec(t);
    if (spec.file.exists) spec.file.delete();
    const mark = verifiedMark(spec);
    if (mark.exists) mark.delete();
  }
}
