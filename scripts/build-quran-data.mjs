// Builds src/data/generated/*.json from the upstream sources in data-src/ (see fetch-sources.sh).
//
//  - quran-text.json : Tanzil Uthmani text, one string per ayah, VERBATIM (never modified), with Tanzil's notice.
//  - meta.json       : surah names/lengths, and the page / juz / hizb boundaries of the 604-page Madani mushaf (Tanzil).
//  - layout.json     : for each of the 604 pages, its 15 lines (surah header, basmala, or a run of words), with
//                      line breaks taken from DigitalKhatt's Madina mushaf, plus each line's width in em of
//                      Amiri Quran as shaped by HarfBuzz (used to choose a font size that fits the page).
//
// Every line break is validated against the ayah numbers in the DigitalKhatt data, every page start against
// Tanzil's page table, and the per-ayah word counts against Tilawa's reference (when present), so a mismatch
// fails the build instead of shipping a misaligned page.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import * as hb from "harfbuzzjs";

const require = createRequire(import.meta.url);
const root = new URL("..", import.meta.url).pathname;
const src = (f) => readFileSync(root + "data-src/" + f, "utf8");
const out = (f, v) => writeFileSync(root + "src/data/generated/" + f, JSON.stringify(v));

// ---------- Tanzil text ----------
const raw = src("quran-uthmani.txt");
const ayahs = []; // { s, a, text }
const noticeLines = [];
for (const line of raw.split("\n")) {
  if (line.startsWith("#")) { noticeLines.push(line); continue; }
  if (!line.includes("|")) continue;
  const [s, a, text] = line.split("|");
  ayahs.push({ s: +s, a: +a, text });
}
if (ayahs.length !== 6236) throw new Error(`expected 6236 ayahs, got ${ayahs.length}`);
const notice = noticeLines.join("\n").trim();
if (!notice.includes("Tanzil")) throw new Error("Tanzil notice missing");

// ---------- Tanzil metadata (parse the JS literals without evaluating them) ----------
function parseJsArray(text, start) {
  let i = start;
  const ws = () => {
    for (;;) {
      while (/\s|,/.test(text[i])) i++;
      if (text.startsWith("//", i)) { while (text[i] !== "\n") i++; continue; }
      break;
    }
  };
  const value = () => {
    ws();
    const c = text[i];
    if (c === "[") {
      i++;
      const arr = [];
      for (;;) { ws(); if (text[i] === "]") { i++; return arr; } arr.push(value()); }
    }
    if (c === "'" || c === '"') {
      const q = c; i++; let s = "";
      while (text[i] !== q) { if (text[i] === "\\") i++; s += text[i++]; }
      i++; return s;
    }
    const m = /^-?\d+(\.\d+)?/.exec(text.slice(i));
    if (!m) throw new Error("parse error near " + text.slice(i, i + 40));
    i += m[0].length; return Number(m[0]);
  };
  return value();
}
const qd = src("quran-data.js");
const table = (name) => parseJsArray(qd, qd.indexOf("[", qd.indexOf(`QuranData.${name} = [`))).filter((r) => r.length);
const suras = table("Sura").slice(0, 114).map(([start, ayas, order, rukus, name, tname, ename, type]) => ({ start, ayas, name, tname, ename, type }));
const pageStarts = table("Page").slice(0, 604).map(([s, a]) => [s, a]);
const juzStarts = table("Juz").slice(0, 30).map(([s, a]) => [s, a]);
const hizbQuarters = table("HizbQaurter").slice(0, 240).map(([s, a]) => [s, a]);
const sajdas = table("Sajda").map(([s, a, kind]) => [s, a, kind]);
if (pageStarts.length !== 604 || juzStarts.length !== 30 || hizbQuarters.length !== 240) throw new Error("metadata tables");

// ---------- Display tokens: one real word each, with its pause / sajdah / rub-el-hizb signs kept attached ----------
const isWord = (t) => /\p{L}/u.test(t);
const tokens = []; // { s, a, w, text }
const basmalaOf = new Map(); // surah -> the 4 basmala words as Tanzil prints them at the head of ayah 1
const ayahTokenRange = new Map(); // "s:a" -> [first, last]
for (const { s, a, text } of ayahs) {
  let parts = text.split(" ");
  // Tanzil prints the basmala at the head of ayah 1 of every surah except 1 and 9. It is not part of the
  // numbered ayah, and the mushaf sets it on its own line, so it is split off here (the string is untouched).
  if (a === 1 && s !== 1 && s !== 9) {
    basmalaOf.set(s, parts.slice(0, 4).join(" "));
    parts = parts.slice(4);
  }
  const group = [];
  let pendingPrefix = "";
  for (const p of parts) {
    if (isWord(p)) group.push({ text: pendingPrefix + p }), (pendingPrefix = "");
    else if (p === "۞") pendingPrefix = p + " "; // rub el hizb precedes the word it marks
    else group[group.length - 1].text += " " + p; // pause marks and sajdah follow their word
  }
  if (pendingPrefix) throw new Error(`dangling sign in ${s}:${a}`);
  const first = tokens.length;
  group.forEach((g, i) => tokens.push({ s, a, w: i + 1, text: g.text }));
  ayahTokenRange.set(`${s}:${a}`, [first, tokens.length - 1]);
}
// Rejoining the tokens must give back the exact Tanzil strings.
for (const { s, a, text } of ayahs) {
  const [f, l] = ayahTokenRange.get(`${s}:${a}`);
  const body = tokens.slice(f, l + 1).map((t) => t.text).join(" ");
  const full = basmalaOf.has(s) && a === 1 ? basmalaOf.get(s) + " " + body : body;
  if (full !== text) throw new Error(`token round-trip failed at ${s}:${a}`);
}

// Tilawa's reference indexes words the same way (1-based, pause marks excluded). Check every ayah's count.
const refPath = root + "node_modules/@tilawa/core/assets/ref-v2.json";
if (existsSync(refPath)) {
  const ref = JSON.parse(readFileSync(refPath, "utf8")).ayahs;
  for (const r of ref) {
    const [f, l] = ayahTokenRange.get(`${r.s}:${r.a}`);
    if (l - f + 1 !== r.w.length) throw new Error(`word count differs from Tilawa reference at ${r.s}:${r.a}`);
  }
  console.log("word indices agree with Tilawa ref-v2 for all 6236 ayahs");
}

// ---------- DigitalKhatt line breaks ----------
const dkSrc = src("quran_text_old_madinah.ts");
const dkPages = parseJsArray(dkSrc, dkSrc.indexOf("["));
if (dkPages.length !== 604) throw new Error("DK pages");
const arabicDigits = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
const fromArabic = (t) => Number([...t].map((c) => "٠١٢٣٤٥٦٧٨٩".indexOf(c)).join(""));

// ---------- HarfBuzz widths ----------
const fontData = readFileSync(root + "assets/fonts/AmiriQuran.ttf");
const face = new hb.Face(new hb.Blob(fontData.buffer.slice(fontData.byteOffset, fontData.byteOffset + fontData.byteLength)));
const font = new hb.Font(face);
const upem = face.upem ?? face.getUpem?.() ?? 1000;
const widthEm = (text) => {
  const buf = new hb.Buffer();
  buf.addText(text);
  buf.guessSegmentProperties();
  hb.shape(font, buf);
  const w = buf.getGlyphPositions().reduce((n, p) => n + p.xAdvance, 0);
  buf.destroy?.();
  return w / upem;
};

let t = 0; // next token
let surahOfNext = 1;
const pages = [];
for (let p = 0; p < 604; p++) {
  const lines = [];
  for (const line of dkPages[p]) {
    if (line.startsWith("سُورَةُ")) {
      // The surah whose header this is: the surah of the next token.
      surahOfNext = tokens[t].s;
      if (tokens[t].a !== 1) throw new Error(`header not at an ayah 1 on page ${p + 1}`);
      lines.push([0, surahOfNext]);
      continue;
    }
    const parts = line.split(/\s+/).filter(Boolean);
    if (!line.includes("۝") && parts.length === 4 && parts[0].startsWith("بِسْمِ") && tokens[t].a === 1 && tokens[t].s !== 1) {
      if (!basmalaOf.has(tokens[t].s)) throw new Error(`unexpected basmala page ${p + 1}`);
      lines.push([1, tokens[t].s]);
      continue;
    }
    const first = t;
    let markers = 0;
    for (const part of parts) {
      if (part.startsWith("۝")) {
        const n = fromArabic(part.slice(1));
        const prev = tokens[t - 1];
        const [, last] = ayahTokenRange.get(`${prev.s}:${prev.a}`);
        if (prev.a !== n || last !== t - 1) throw new Error(`ayah marker ${n} misaligned on page ${p + 1} (at ${prev.s}:${prev.a}:${prev.w})`);
        markers++;
      } else if (isWord(part)) {
        t++;
      }
    }
    if (t === first) throw new Error(`empty line on page ${p + 1}: ${line}`);
    const em = tokens.slice(first, t).reduce((n, tok) => n + widthEm(tok.text), 0);
    lines.push([2, first, t - 1, Math.round(em * 1000), markers]);
  }
  // Page must start where Tanzil says it does.
  const firstTok = lines.find((l) => l[0] === 2);
  const [ps, pa] = pageStarts[p];
  const ft = tokens[firstTok[1]];
  if (ft.s !== ps || ft.a !== pa || ft.w !== 1) throw new Error(`page ${p + 1} starts at ${ft.s}:${ft.a}:${ft.w}, Tanzil says ${ps}:${pa}`);
  pages.push(lines);
}
if (t !== tokens.length) throw new Error(`${tokens.length - t} tokens left over`);
console.log(`layout ok: 604 pages, ${tokens.length} words, all line breaks and page starts verified`);

out("quran-text.json", {
  source: "Tanzil Quran Text (Uthmani, Version 1.1), https://tanzil.net",
  license: "Creative Commons Attribution 3.0. Verbatim copy: the text must not be changed.",
  notice,
  ayahs: ayahs.map((x) => x.text),
});
out("meta.json", {
  source: "Tanzil Quran metadata (quran-data.js), https://tanzil.net",
  suras: suras.map(({ ayas, name, tname, ename, type }) => ({ ayas, name, tname, ename, type })),
  pageStarts, juzStarts, hizbQuarters, sajdas,
});
out("layout.json", {
  source: "Line breaks of the 15-line, 604-page Madina mushaf (1405H) from DigitalKhatt quran_text_old_madinah (MIT), https://github.com/DigitalKhatt/digitalkhatt-js",
  widthFont: "Amiri Quran 1.003 (HarfBuzz), em x 1000",
  pages,
});
