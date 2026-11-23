// Tilawa, running inside the app's hidden WebView.
//
// Tilawa's JavaScript (tracker and mistake checker) needs a JIT to keep up with a reciter on a phone, and Hermes
// has none; the system WebView's V8 does. So the engine runs here with onnxruntime-web (WASM), fed with PCM that
// the app records natively. Everything stays on the device: the model, the reference and the WASM runtime are
// read from the app's own files, and nothing is fetched from the network.
//
// Bundled by scripts/build-engine.mjs into src/engine/generated/engine-html.ts.
import * as ort from "onnxruntime-web/wasm";
import { MODEL_REGISTRY, createEngine, loadReferenceIndex, ortBackend } from "@tilawa/core";
import phrases from "@tilawa/core/assets/phrases-v1.json";

const send = (msg) => window.ReactNativeWebView.postMessage(JSON.stringify(msg));
const log = (m) => send({ t: "log", m });

let engine = null;
let model = null;
let session = null;
let unsubscribe = null;
let queue = Promise.resolve();

function readFile(url, type) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("GET", url);
    x.responseType = type;
    x.onload = () => (x.status === 0 || x.status === 200 ? resolve(x.response) : reject(new Error(`${x.status} reading ${url}`)));
    x.onerror = () => reject(new Error(`Could not read ${url}`));
    x.send();
  });
}

function compact(e) {
  if (e.type === "position") {
    const top = e.observed[0];
    return { type: "position", state: e.state, timeMs: e.timeMs, word: top ? top.word : null, confidence: top ? top.confidence : 0 };
  }
  if (e.type === "checker") {
    return { type: "checker", id: e.id, state: e.state, errorClass: e.errorClass, location: e.location, timeMs: e.timeMs };
  }
  return null;
}

function decode(b64) {
  const bin = atob(b64);
  const n = bin.length >> 1;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
    if (v >= 0x8000) v -= 0x10000;
    out[i] = v / 32768;
  }
  return out;
}

async function load({ tier, modelUrl, referenceUrl, wasmUrl }) {
  const t0 = performance.now();
  if (engine && model && model.tier === tier) return { ms: 0 };
  if (model) await model.loaded.backend.release().catch(() => {});
  engine = null;
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  ort.env.wasm.wasmBinary = await readFile(wasmUrl, "arraybuffer");
  log(`wasm ${ort.env.wasm.wasmBinary.byteLength} bytes`);
  const [bytes, refText] = await Promise.all([readFile(modelUrl, "arraybuffer"), readFile(referenceUrl, "text")]);
  log(`model ${bytes.byteLength} bytes, reference ${refText.length} chars, ${Math.round(performance.now() - t0)} ms`);
  const spec = MODEL_REGISTRY.tiers.find((t) => t.tier === tier);
  const backend = await ortBackend(ort, new Uint8Array(bytes), "onnxruntime-web/wasm", { executionProviders: ["wasm"] });
  log(`onnx session ${Math.round(performance.now() - t0)} ms`);
  const loaded = { manifest: spec.manifest, backend, supported: spec.supported };
  engine = createEngine({
    reference: loadReferenceIndex(JSON.parse(refText)),
    phrases,
    model: loaded,
    info: { backend: "onnxruntime-web/wasm (webview)", tier, modelRelease: spec.version, modelSha256: spec.sha256 },
  });
  model = { tier, loaded };
  log(`engine ${Math.round(performance.now() - t0)} ms`);
  // Build the engine's indexes now, not on the first tap.
  engine.startFreeRecitation().dispose();
  log(`warm ${Math.round(performance.now() - t0)} ms`);
  return { ms: Math.round(performance.now() - t0) };
}

function start(policy) {
  if (!engine) throw new Error("Engine not loaded");
  if (session) session.dispose();
  const s = engine.startFreeRecitation(policy);
  session = s;
  unsubscribe = s.subscribe((e) => {
    const c = compact(e);
    if (c && session === s) send({ t: "event", e: c });
  });
  queue = Promise.resolve();
}

async function stop() {
  const s = session;
  if (!s) return;
  await queue.catch(() => {});
  const tail = await s.end().catch(() => []);
  // Subscribers already got the tail; send it again only if the session was swapped meanwhile.
  if (session !== s) for (const e of tail) { const c = compact(e); if (c) send({ t: "event", e: c }); }
  unsubscribe && unsubscribe();
  s.dispose();
  if (session === s) session = null;
}

async function handle(msg) {
  switch (msg.t) {
    case "load":
      return load(msg);
    case "start":
      return start(msg.policy);
    case "audio": {
      const s = session;
      if (!s) return;
      const samples = decode(msg.b64);
      queue = queue.then(async () => {
        const t0 = performance.now();
        await s.pushAudio(samples, msg.rate);
        busy += performance.now() - t0;
      });
      return;
    }
    case "stop":
      return stop();
    case "ping": {
      await queue.catch(() => {});
      return { busyMs: Math.round(busy), audioMs: session ? session.now() : 0 };
    }
  }
}
let busy = 0;

function onMessage(ev) {
  let msg;
  try {
    msg = JSON.parse(typeof ev.data === "string" ? ev.data : "");
  } catch {
    return;
  }
  Promise.resolve()
    .then(() => handle(msg))
    .then((result) => msg.id !== undefined && send({ t: "reply", id: msg.id, ok: true, result }))
    .catch((err) => {
      const message = err && err.message ? err.message : String(err);
      if (msg.id !== undefined) send({ t: "reply", id: msg.id, ok: false, error: message });
      else send({ t: "error", error: message });
    });
}

window.addEventListener("message", onMessage);
document.addEventListener("message", onMessage);
window.addEventListener("error", (e) => send({ t: "error", error: String(e.message) }));
window.addEventListener("unhandledrejection", (e) => send({ t: "error", error: String(e.reason && e.reason.message ? e.reason.message : e.reason) }));
send({ t: "hello" });
