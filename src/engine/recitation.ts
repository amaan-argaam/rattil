/**
 * Listens to the reciter and follows along, on-device, with Tilawa (https://github.com/yazinsai/tilawa).
 *
 * Audio never leaves the phone. The microphone is read natively (react-native-audio-api, 16 kHz mono) and pushed
 * into a Tilawa free-recitation session running in the app's hidden engine WebView (see webengine/engine.js). The
 * session reports where the reciter is (`position`) and possible memorization mistakes (`checker`); this module
 * turns those into the token indices the mushaf highlights.
 */
import type { TierName } from "@tilawa/core";
import { Asset } from "expo-asset";
import { useSyncExternalStore } from "react";
import { AudioManager, AudioRecorder } from "react-native-audio-api";
import { tokenIndex } from "../data/quran";
import { ensureAsset, referenceSpec, removeOtherTiers, tierSpec } from "./assets";
import { engineGeneration, onEngineError, onEngineEvent, post, request } from "./host";
import type { EngineEvent } from "./host";

export type Status = "idle" | "preparing" | "listening" | "stopping" | "error";
export type MistakeKind = "wrong_word" | "omitted_word" | "added_word" | "skipped_passage";

export interface RecitationState {
  status: Status;
  /** 0..1 while downloading the model. */
  progress: number;
  progressLabel: string;
  error: string | null;
  /** Token the reciter is on, or -1. */
  current: number;
  /** True once Tilawa has locked onto a place. */
  locked: boolean;
  /** Confirmed mistakes by token. */
  mistakes: ReadonlyMap<number, MistakeKind>;
  version: number;
}

let state: RecitationState = {
  status: "idle",
  progress: 0,
  progressLabel: "",
  error: null,
  current: -1,
  locked: false,
  mistakes: new Map(),
  version: 0,
};
const listeners = new Set<() => void>();
const set = (patch: Partial<RecitationState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
export const getRecitation = () => state;
export const useRecitation = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state,
  );

/** Larger evidence cells: about 30% less work per second of audio, with the same positions (measured). */
const POLICY = { evidenceMs: 200 };

// ---------------------------------------------------------------- engine

let loaded: { tier: TierName; generation: number } | null = null;
let loading: Promise<void> | null = null;
let recorder: AudioRecorder | null = null;
let listening = false;
const mistakeIds = new Map<string, number>(); // checker id -> token

const fileUrl = (uri: string) => (uri.startsWith("file://") ? uri : `file://${uri}`);

async function wasmUrl(): Promise<string> {
  const asset = Asset.fromModule(require("../../assets/engine/ort-wasm-simd-threaded.wasm.bin"));
  await asset.downloadAsync();
  return fileUrl(asset.localUri ?? asset.uri);
}

/** Downloads (once) and loads the model into the engine. Safe to call repeatedly. */
export function prepareEngine(tier: TierName, quiet = false): Promise<void> {
  if (loaded && loaded.tier === tier && loaded.generation === engineGeneration()) return Promise.resolve();
  if (loading) return loading;
  loading = (async () => {
    const ref = referenceSpec();
    const mdl = tierSpec(tier);
    const total = ref.bytes + mdl.bytes;
    let refDone = 0;
    let mdlDone = 0;
    const report = () => {
      if (!quiet) set({ progress: (refDone + mdlDone) / total, progressLabel: "Downloading the recitation model (once)…" });
    };
    const [refFile, mdlFile] = await Promise.all([
      ensureAsset(ref, (n) => ((refDone = n), report())),
      ensureAsset(mdl, (n) => ((mdlDone = n), report())),
    ]);
    removeOtherTiers(tier);
    if (!quiet) set({ progress: 1, progressLabel: "Loading the model…" });
    const generation = engineGeneration();
    const r = await request<{ ms: number }>({
      t: "load",
      tier,
      modelUrl: fileUrl(mdlFile.uri),
      referenceUrl: fileUrl(refFile.uri),
      wasmUrl: await wasmUrl(),
    });
    if (__DEV__) console.log(`[rattil] engine loaded in ${r.ms} ms`);
    loaded = { tier, generation };
  })().finally(() => {
    loading = null;
  });
  return loading;
}

/** Warm the engine up in the background if the model is already on the phone, so the first tap is quick. */
export function warmUp(tier: TierName) {
  if (tierSpec(tier).file.exists && referenceSpec().file.exists) prepareEngine(tier, true).catch(() => {});
}

let lastAmbiguousAyah = "";

function onEvent(e: EngineEvent) {
  if (!listening && state.status !== "stopping") return;
  if (e.type === "position") {
    const w = e.word;
    if (e.state === "locked" && w) {
      const t = tokenIndex(w.surah, w.ayah, w.word);
      if (t >= 0 && (t !== state.current || !state.locked)) set({ current: t, locked: true });
    } else if (e.state === "ambiguous" && w && !state.locked) {
      // Before Tilawa commits, show its best guess once two updates in a row agree on the ayah, so the page
      // opens sooner. A locked position always wins.
      const key = `${w.surah}:${w.ayah}`;
      if (key === lastAmbiguousAyah) {
        const t = tokenIndex(w.surah, w.ayah, w.word);
        if (t >= 0 && t !== state.current) set({ current: t });
      }
      lastAmbiguousAyah = key;
    } else if (e.state === "lost" && state.locked) {
      set({ locked: false });
    }
    return;
  }
  if (e.type === "checker" && e.location && e.id) {
    const t = tokenIndex(e.location.surah, e.location.ayah, e.location.word);
    if (t < 0) return;
    const next = new Map(state.mistakes);
    if (e.state === "confirmed") {
      mistakeIds.set(e.id, t);
      next.set(t, e.errorClass as MistakeKind);
    } else if (e.state === "resolved" || e.state === "uncertain") {
      const at = mistakeIds.get(e.id);
      if (at !== undefined) next.delete(at);
      mistakeIds.delete(e.id);
    } else return; // "suspected": wait; only confirmed mistakes are shown
    set({ mistakes: next, version: state.version + 1 });
  }
}
onEngineEvent(onEvent);
onEngineError((message) => {
  if (listening) fail(new Error(message));
});

// PCM16 little-endian, base64: compact and cheap to decode on the other side.
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function toBase64Pcm16(f: Float32Array): string {
  const bytes = new Uint8Array(f.length * 2);
  for (let i = 0; i < f.length; i++) {
    const v = Math.max(-1, Math.min(1, f[i]));
    const s = v < 0 ? v * 0x8000 : v * 0x7fff;
    const n = s | 0;
    bytes[2 * i] = n & 0xff;
    bytes[2 * i + 1] = (n >> 8) & 0xff;
  }
  let out = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  if (i < bytes.length) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8);
    out += B64[n >> 18] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : "=") + "=";
  }
  return out;
}

export function pushPcm(samples: Float32Array, rate: number) {
  post({ t: "audio", rate, b64: toBase64Pcm16(samples) });
}

async function beginSession() {
  mistakeIds.clear();
  lastAmbiguousAyah = "";
  set({ mistakes: new Map(), version: state.version + 1, locked: false, current: -1 });
  await request({ t: "start", policy: POLICY });
  listening = true;
}

/** Starts a free recitation from anywhere: Tilawa finds the place. */
export async function startRecitation(tier: TierName): Promise<void> {
  if (state.status === "preparing" || state.status === "listening") return;
  set({ status: "preparing", error: null, progress: 0, progressLabel: "Preparing…" });
  try {
    const permission = await AudioManager.requestRecordingPermissions();
    if (permission !== "Granted") throw new Error("Microphone permission is needed to follow your recitation.");
    await prepareEngine(tier);
    await beginSession();

    const rec = new AudioRecorder();
    recorder = rec;
    rec.onError((err) => fail(new Error(err.message)));
    const ready = rec.onAudioReady({ sampleRate: 16000, bufferLength: 1600, channelCount: 1 }, ({ buffer, numFrames }) => {
      if (!listening) return;
      pushPcm(buffer.getChannelData(0).subarray(0, numFrames), buffer.sampleRate);
    });
    if (ready.status === "error") throw new Error(ready.message);
    const started = await rec.start();
    if (started.status === "error") throw new Error(started.message);
    set({ status: "listening", progress: 0, progressLabel: "" });
  } catch (e) {
    await fail(e);
  }
}

export async function stopRecitation(): Promise<void> {
  if (state.status !== "listening") return;
  set({ status: "stopping" });
  await teardown();
  set({ status: "idle", locked: false });
}

async function teardown() {
  const rec = recorder;
  recorder = null;
  if (rec) {
    rec.clearOnAudioReady();
    rec.clearOnError();
    await rec.stop().catch(() => {});
  }
  if (listening) {
    const p = await request<{ busyMs: number; audioMs: number }>({ t: "ping" }, 30000).catch(() => null);
    if (p) console.log(`[rattil] session: ${(p.audioMs / 1000).toFixed(1)} s of audio`);
    // Decide the mistakes still open; their events arrive before the reply.
    await request({ t: "stop" }, 30000).catch(() => {});
  }
  listening = false;
}

async function fail(e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  await teardown().catch(() => {});
  set({ status: "error", error: message, progress: 0, progressLabel: "" });
}

export function clearError() {
  if (state.status === "error") set({ status: "idle", error: null });
}

/**
 * Testing aid: replays a 16 kHz mono PCM16 WAV as if it came from the microphone, so the follower can be checked
 * on an emulator without speaking. Only reachable in development builds, or in a local build made with
 * EXPO_PUBLIC_REPLAY_URL set (never set for published releases).
 */
export const REPLAY_URL = __DEV__
  ? process.env.EXPO_PUBLIC_REPLAY_URL || "https://raw.githubusercontent.com/yazinsai/tilawa/main/packages/tilawa-core/test/fixtures/tlog-clean-00010-630.wav"
  : process.env.EXPO_PUBLIC_REPLAY_URL;

export async function replayWav(tier: TierName, wav: Uint8Array): Promise<void> {
  if (!REPLAY_URL || state.status !== "idle") return;
  set({ status: "preparing", error: null });
  try {
    await prepareEngine(tier);
    await beginSession();
    set({ status: "listening" });
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    let off = 12;
    let rate = 16000;
    let data = 0;
    let len = 0;
    while (off + 8 <= view.byteLength) {
      const id = String.fromCharCode(view.getUint8(off), view.getUint8(off + 1), view.getUint8(off + 2), view.getUint8(off + 3));
      const size = view.getUint32(off + 4, true);
      if (id === "fmt ") rate = view.getUint32(off + 12, true);
      if (id === "data") {
        data = off + 8;
        len = size;
        break;
      }
      off += 8 + size + (size & 1);
    }
    const n = Math.floor(len / 2);
    const chunk = rate / 10;
    const t0 = Date.now();
    for (let i = 0; i < n && listening; i += chunk) {
      const m = Math.min(chunk, n - i);
      const f = new Float32Array(m);
      for (let j = 0; j < m; j++) f[j] = view.getInt16(data + (i + j) * 2, true) / 32768;
      pushPcm(f, rate);
      // Real time, as a microphone would deliver it.
      const due = t0 + ((i + m) / rate) * 1000;
      await new Promise((r) => setTimeout(r, Math.max(0, due - Date.now())));
      if ((i / chunk) % 50 === 49) {
        const p = await request<{ busyMs: number; audioMs: number }>({ t: "ping" });
        console.log(`[rattil] audio ${((i + m) / rate).toFixed(1)} s, engine busy ${p.busyMs} ms, processed ${p.audioMs} ms, at ${state.current}`);
      }
    }
    if (listening) await stopRecitation();
  } catch (e) {
    console.log(`[rattil] replay failed: ${e instanceof Error ? e.message : e}`);
    await fail(e);
  }
}
