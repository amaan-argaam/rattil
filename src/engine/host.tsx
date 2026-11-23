/**
 * Hosts the Tilawa engine page in a hidden WebView and gives the rest of the app a small request/response bridge.
 * See webengine/engine.js for why the engine runs there.
 */
import { memo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";
import { ENGINE_HTML } from "./generated/engine-html";

export interface EngineEvent {
  type: "position" | "checker";
  state: string;
  timeMs: number;
  word?: { surah: number; ayah: number; word: number } | null;
  confidence?: number;
  id?: string;
  errorClass?: string;
  location?: { surah: number; ayah: number; word: number };
}

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

type WebViewHandle = { postMessage(data: string): void; reload(): void };
let webview: WebViewHandle | null = null;
let ready: Promise<void>;
let markReady: () => void = () => {};
/** Bumped whenever the engine page (re)starts; a load is only valid for the generation it was made in. */
let generation = 0;
const resetReady = () => {
  generation++;
  ready = new Promise((r) => (markReady = r));
};
export const engineGeneration = () => generation;
resetReady();
let nextId = 1;
const pending = new Map<number, Pending>();
const eventListeners = new Set<(e: EngineEvent) => void>();
const errorListeners = new Set<(message: string) => void>();

export function onEngineEvent(l: (e: EngineEvent) => void) {
  eventListeners.add(l);
  return () => eventListeners.delete(l);
}
export function onEngineError(l: (message: string) => void) {
  errorListeners.add(l);
  return () => errorListeners.delete(l);
}

/** Fire-and-forget message (audio). */
export function post(msg: object) {
  webview?.postMessage(JSON.stringify(msg));
}

/** Request with a reply. */
export async function request<T = unknown>(msg: object, timeoutMs = 120000): Promise<T> {
  await ready;
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("The recognition engine did not answer"));
    }, timeoutMs);
    pending.set(id, {
      resolve: (v) => (clearTimeout(timer), resolve(v as T)),
      reject: (e) => (clearTimeout(timer), reject(e)),
    });
    webview?.postMessage(JSON.stringify({ ...msg, id }));
  });
}

function onMessage(e: WebViewMessageEvent) {
  let msg: { t: string; id?: number; ok?: boolean; result?: unknown; error?: string; e?: EngineEvent };
  try {
    msg = JSON.parse(e.nativeEvent.data);
  } catch {
    return;
  }
  if (msg.t === "hello") markReady();
  else if (msg.t === "log") console.log(`[engine] ${(msg as { m?: string }).m}`);
  else if (msg.t === "event" && msg.e) eventListeners.forEach((l) => l(msg.e!));
  else if (msg.t === "reply" && msg.id !== undefined) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.ok) p?.resolve(msg.result);
    else p?.reject(new Error(msg.error ?? "Engine error"));
  } else if (msg.t === "error") errorListeners.forEach((l) => l(msg.error ?? "Engine error"));
}

export const EngineHost = memo(function EngineHost() {
  const ref = useRef<WebViewHandle | null>(null);
  return (
    <View style={styles.host} pointerEvents="none">
      <WebView
        ref={(w: unknown) => {
          ref.current = w as WebViewHandle | null;
          webview = ref.current;
        }}
        source={{ html: ENGINE_HTML, baseUrl: "file:///android_asset/" }}
        originWhitelist={["*"]}
        javaScriptEnabled
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        cacheEnabled={false}
        incognito
        onMessage={onMessage}
        onContentProcessDidTerminate={() => {
          // The renderer was killed (e.g. low memory): start over on the next use.
          console.log("[engine] content process terminated");
          resetReady();
          pending.forEach((p) => p.reject(new Error("The recognition engine stopped")));
          pending.clear();
          ref.current?.reload();
        }}
        onRenderProcessGone={(e) => {
          console.log(`[engine] render process gone, crashed=${e.nativeEvent.didCrash}`);
          resetReady();
          pending.forEach((p) => p.reject(new Error("The recognition engine stopped")));
          pending.clear();
          ref.current?.reload();
        }}
        style={styles.webview}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  host: { position: "absolute", width: 1, height: 1, opacity: 0, left: -10, top: -10, overflow: "hidden" },
  webview: { width: 1, height: 1, backgroundColor: "transparent" },
});
