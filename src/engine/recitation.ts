/**
 * Listens to the reciter and follows along, on-device, with Tilawa (https://github.com/yazinsai/tilawa).
 *
 * Audio never leaves the phone: the microphone is read by react-native-audio-api and pushed straight into a Tilawa
 * free-recitation session running on onnxruntime-react-native. The session reports where the reciter is
 * (`position`) and possible memorization mistakes (`checker`); this module turns those into the token indices the
 * mushaf highlights.
 */
import { ortBackend } from "@tilawa/core";
import type { CheckerEvent, EngineEvent, LoadedModel, OrtModule, ReferenceAsset, TilawaSession, TierName } from "@tilawa/core";
import { createTilawa } from "@tilawa/core/react-native";
import type { Tilawa } from "@tilawa/core/react-native";
import * as ort from "onnxruntime-react-native";
import { AudioManager, AudioRecorder } from "react-native-audio-api";
import { useSyncExternalStore } from "react";
import { tokenIndex } from "../data/quran";
import { ensureAsset, pathOf, referenceSpec, removeOtherTiers, tierSpec } from "./assets";

export type Status = "idle" | "preparing" | "listening" | "stopping" | "error";
export type MistakeKind = CheckerEvent["errorClass"];

export interface RecitationState {
  status: Status;
  /** 0..1 while preparing (downloading or loading the model). */
  progress: number;
  progressLabel: string;
  error: string | null;
  /** Token the reciter is on, or -1. */
  current: number;
  /** True once Tilawa has locked onto a place. */
  locked: boolean;
  /** Confirmed mistakes by token. Bumped `version` on change. */
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

// ---------------------------------------------------------------- engine

let tilawa: Tilawa | null = null;
let model: LoadedModel | null = null;
let loadedTier: TierName | null = null;
let reference: ReferenceAsset | null = null;
let session: TilawaSession | null = null;
let recorder: AudioRecorder | null = null;
let unsubscribe: (() => void) | null = null;
const mistakeIds = new Map<string, number>(); // checker id -> token

async function ensureEngine(tier: TierName): Promise<Tilawa> {
  if (tilawa && loadedTier === tier) return tilawa;
  await disposeEngine();

  const ref = referenceSpec();
  const mdl = tierSpec(tier);
  const total = ref.bytes + mdl.bytes;
  let refDone = 0;
  let mdlDone = 0;
  const report = () => set({ progress: (refDone + mdlDone) / total, progressLabel: "Downloading the recitation model (once)…" });

  const [refFile, mdlFile] = await Promise.all([
    ensureAsset(ref, (n) => ((refDone = n), report())),
    ensureAsset(mdl, (n) => ((mdlDone = n), report())),
  ]);
  removeOtherTiers(tier);

  set({ progress: 1, progressLabel: "Loading the model…" });
  if (!reference) reference = JSON.parse(await refFile.text()) as ReferenceAsset;
  const backend = await ortBackend(ort as unknown as OrtModule, pathOf(mdlFile), "onnxruntime-react-native/cpu", {
    executionProviders: ["cpu"],
    intraOpNumThreads: 2,
  });
  model = { manifest: mdl.tier.manifest, backend, supported: mdl.tier.supported };
  tilawa = await createTilawa({ tier, model, reference });
  loadedTier = tier;
  return tilawa;
}

async function disposeEngine() {
  await tilawa?.dispose().catch(() => {});
  await model?.backend.release().catch(() => {});
  tilawa = null;
  model = null;
  loadedTier = null;
}

function onEvent(e: EngineEvent) {
  if (e.type === "position") {
    const top = e.observed[0];
    if (e.state === "locked" && top) {
      const t = tokenIndex(top.word.surah, top.word.ayah, top.word.word);
      if (t >= 0 && (t !== state.current || !state.locked)) set({ current: t, locked: true });
    } else if (e.state === "lost" && state.locked) {
      set({ locked: false });
    }
    return;
  }
  if (e.type === "checker") {
    const t = tokenIndex(e.location.surah, e.location.ayah, e.location.word);
    if (t < 0) return;
    const next = new Map(state.mistakes);
    if (e.state === "confirmed") {
      mistakeIds.set(e.id, t);
      next.set(t, e.errorClass);
    } else if (e.state === "resolved" || e.state === "uncertain") {
      const at = mistakeIds.get(e.id);
      if (at !== undefined) next.delete(at);
      mistakeIds.delete(e.id);
    } else return; // "suspected": wait; only confirmed mistakes are shown
    set({ mistakes: next, version: state.version + 1 });
  }
}

/** Starts a free recitation from anywhere: Tilawa finds the place. */
export async function startRecitation(tier: TierName): Promise<void> {
  if (state.status === "preparing" || state.status === "listening") return;
  set({ status: "preparing", error: null, progress: 0, progressLabel: "Preparing…" });
  try {
    const permission = await AudioManager.requestRecordingPermissions();
    if (permission !== "Granted") throw new Error("Microphone permission is needed to follow your recitation.");
    const t = await ensureEngine(tier);

    mistakeIds.clear();
    set({ mistakes: new Map(), version: state.version + 1, locked: false });
    const s = t.startFreeRecitation();
    session = s;
    unsubscribe = s.subscribe(onEvent);

    const rec = new AudioRecorder();
    recorder = rec;
    rec.onError((err) => fail(new Error(err.message)));
    const ready = rec.onAudioReady({ sampleRate: 16000, bufferLength: 1600, channelCount: 1 }, ({ buffer, numFrames }) => {
      if (session !== s) return;
      // The buffer is reused by the recorder: copy before handing it on.
      const samples = buffer.getChannelData(0).slice(0, numFrames);
      s.pushAudio(samples, buffer.sampleRate).catch(fail);
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
  if (state.status !== "listening" && state.status !== "error") return;
  set({ status: "stopping" });
  await teardown();
  set({ status: "idle", locked: false });
}

async function teardown() {
  const rec = recorder;
  const s = session;
  recorder = null;
  session = null;
  if (rec) {
    rec.clearOnAudioReady();
    rec.clearOnError();
    await rec.stop().catch(() => {});
  }
  unsubscribe?.();
  unsubscribe = null;
  if (s) {
    // Decide the mistakes still open, then keep showing the confirmed ones.
    const tail = await s.end().catch(() => [] as EngineEvent[]);
    tail.forEach(onEvent);
    s.dispose();
  }
}

async function fail(e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  await teardown().catch(() => {});
  set({ status: "error", error: message, progress: 0, progressLabel: "" });
}

export function clearError() {
  if (state.status === "error") set({ status: "idle", error: null });
}

/** Forget the highlight and the marks (e.g. when the reciter starts over). */
export function clearMarks() {
  mistakeIds.clear();
  set({ current: -1, locked: false, mistakes: new Map(), version: state.version + 1 });
}

/**
 * Development aid: replays a 16 kHz mono PCM16 WAV into a session as if it came from the microphone, so the
 * follower can be checked on an emulator without speaking. Not reachable in release builds.
 */
export async function replayWav(tier: TierName, wav: Uint8Array): Promise<void> {
  if (!__DEV__) return;
  set({ status: "preparing", error: null });
  try {
    const t = await ensureEngine(tier);
    clearMarks();
    const s = t.startFreeRecitation();
    session = s;
    unsubscribe = s.subscribe(onEvent);
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
    for (let i = 0; i < n && session === s; i += chunk) {
      const m = Math.min(chunk, n - i);
      const f = new Float32Array(m);
      for (let j = 0; j < m; j++) f[j] = view.getInt16(data + (i + j) * 2, true) / 32768;
      await s.pushAudio(f, rate);
      await new Promise((r) => setTimeout(r, 100));
    }
    if (session === s) await stopRecitation();
  } catch (e) {
    await fail(e);
  }
}
