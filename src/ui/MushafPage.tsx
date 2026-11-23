/**
 * One page of the 604-page Madani mushaf: 15 lines (8 on the first two pages), each a surah header, the basmala,
 * or a run of words justified edge to edge like the printed page.
 *
 * Words are drawn exactly as Tanzil writes them (one <Text> per word). Highlighting and mistake marks are drawn
 * around the words, never by changing the text.
 */
import { memo, useMemo } from "react";
import { I18nManager, StyleSheet, Text, View } from "react-native";
import { PAGES, SURAHS, TOKENS, basmalaOf, juzOfPage, surahsOnPage, toArabicDigits } from "../data/quran";
import type { LineSpec } from "../data/quran";
import type { MistakeKind } from "../engine/recitation";
import { FONT_ARABIC, FONT_QURAN, useTheme } from "../theme";
import { AyahMarker, PageFrame, PageNumber, SurahHeader } from "./ornaments";

/** Marker width in em, minimum gap between words in em. */
const MARKER_EM = 1.08;
const GAP_EM = 0.16;
/** Amiri Quran needs about this much line pitch (em) for stacked marks. */
const LINE_PITCH_EM = 1.75;

const denomOf = (l: LineSpec) => {
  if (l[0] !== 2) return 0;
  const items = l[2] - l[1] + 1 + l[4];
  return l[3] / 1000 + l[4] * MARKER_EM + GAP_EM * (items - 1);
};
const pageDenoms = PAGES.map((lines) => Math.max(...lines.map(denomOf)));
/** A typical page's widest line. Sparse pages use this so the type size stays steady from page to page. */
const TYPICAL_DENOM = [...pageDenoms].sort((a, b) => a - b)[Math.floor(pageDenoms.length / 2)];

export interface PageGeometry {
  width: number;
  height: number;
}

interface Props {
  page: number;
  geo: PageGeometry;
  /** Token being recited on this page, or -1. */
  current: number;
  /** "s:a" of the ayah being recited, if it is on this page. */
  activeAyah: string;
  /** Mistakes on this page, as "token:kind,token:kind" (a string so memo can compare it). */
  mistakes: string;
}

export const MushafPage = memo(function MushafPage({ page, geo, current, activeAyah, mistakes }: Props) {
  const t = useTheme();
  const lines = PAGES[page - 1];
  const opening = page <= 2;

  const L = useMemo(() => {
    const band = Math.round(Math.min(geo.width, geo.height) * 0.032);
    const pad = band + 10;
    const headerH = Math.round(geo.height * 0.04);
    const innerW = geo.width - 2 * pad;
    const textW = opening ? innerW * 0.72 : innerW - 6;
    const textH = geo.height - 2 * pad - 2 * headerH;
    const rows = opening ? 15 : lines.length;
    const lineH = textH / rows;
    const denom = opening ? Math.max(...lines.map(denomOf)) * 1.08 : Math.max(pageDenoms[page - 1], TYPICAL_DENOM);
    const fontSize = Math.min(textW / denom, lineH / LINE_PITCH_EM);
    return { band, pad, headerH, textW, textH, lineH, fontSize };
  }, [geo.width, geo.height, page, opening, lines]);

  const mistakeMap = useMemo(() => {
    const m = new Map<number, MistakeKind>();
    if (mistakes) for (const pair of mistakes.split(",")) {
      const [k, v] = pair.split(":");
      m.set(+k, v as MistakeKind);
    }
    return m;
  }, [mistakes]);

  const headerSurah = SURAHS[surahsOnPage(page)[0] - 1];

  return (
    <View style={[styles.paper, { width: geo.width, height: geo.height, backgroundColor: t.paper }]}>
      <PageFrame width={geo.width} height={geo.height} band={L.band} />
      <View style={{ position: "absolute", left: L.pad, right: L.pad, top: L.pad, bottom: L.pad }}>
        <View style={[styles.running, { height: L.headerH }]}>
          <Text allowFontScaling={false} style={[styles.runningText, { color: t.inkSoft, fontSize: L.headerH * 0.5 }]}>
            {"الجزء " + toArabicDigits(juzOfPage(page))}
          </Text>
          <Text allowFontScaling={false} style={[styles.runningText, { color: t.inkSoft, fontSize: L.headerH * 0.5 }]}>
            {"سورة " + headerSurah.name}
          </Text>
        </View>
        <View style={{ height: L.textH, justifyContent: opening ? "center" : "space-between", alignItems: "center" }}>
          {lines.map((l, i) => (
            <Line
              key={i}
              spec={l}
              width={L.textW}
              height={L.lineH}
              fontSize={L.fontSize}
              opening={opening}
              current={l[0] === 2 && current >= l[1] && current <= l[2] ? current : -1}
              activeAyah={l[0] === 2 && activeAyah && lineHasAyah(l, activeAyah) ? activeAyah : ""}
              mistakes={l[0] === 2 ? lineMistakes(l, mistakeMap) : ""}
            />
          ))}
        </View>
        <View style={[styles.footer, { height: L.headerH }]}>
          <PageNumber page={page} size={L.headerH * 0.95} />
        </View>
      </View>
    </View>
  );
});

function lineHasAyah(l: LineSpec, key: string) {
  if (l[0] !== 2) return false;
  const [s, a] = key.split(":").map(Number);
  const first = TOKENS[l[1]];
  const last = TOKENS[l[2]];
  const cmp = (x: { s: number; a: number }) => (x.s - s) * 10000 + (x.a - a);
  return cmp(first) <= 0 && cmp(last) >= 0;
}

function lineMistakes(l: LineSpec, m: Map<number, MistakeKind>) {
  if (l[0] !== 2 || m.size === 0) return "";
  const out: string[] = [];
  for (let i = l[1]; i <= l[2]; i++) if (m.has(i)) out.push(`${i}:${m.get(i)}`);
  return out.join(",");
}

const ROW = I18nManager.isRTL ? "row" : "row-reverse"; // right-to-left on any device locale

interface LineProps {
  spec: LineSpec;
  width: number;
  height: number;
  fontSize: number;
  opening: boolean;
  current: number;
  activeAyah: string;
  mistakes: string;
}

const Line = memo(function Line({ spec, width, height, fontSize, opening, current, activeAyah, mistakes }: LineProps) {
  const t = useTheme();
  const textStyle = { fontFamily: FONT_QURAN, fontSize, lineHeight: height, color: t.ink, includeFontPadding: false } as const;

  if (spec[0] === 0) {
    return (
      <View style={{ width, height, justifyContent: "center", alignItems: "center" }}>
        <SurahHeader name={SURAHS[spec[1] - 1].name} width={Math.min(width, fontSize * 15)} height={Math.min(height * 0.92, fontSize * 2.1)} />
      </View>
    );
  }
  if (spec[0] === 1) {
    return (
      <View style={{ width, height, justifyContent: "center", alignItems: "center" }}>
        <Text allowFontScaling={false} style={textStyle}>
          {basmalaOf(spec[1])}
        </Text>
      </View>
    );
  }

  const [, first, last] = spec;
  const marks = new Map<number, string>();
  if (mistakes) for (const p of mistakes.split(",")) {
    const [k, v] = p.split(":");
    marks.set(+k, v);
  }
  const denom = denomOf(spec);
  const centered = opening || (denom * fontSize) / width < 0.74;
  const [as, aa] = activeAyah ? activeAyah.split(":").map(Number) : [0, 0];
  const inAyah = (i: number) => TOKENS[i].s === as && TOKENS[i].a === aa;
  const markerSize = fontSize * MARKER_EM;

  const children: React.ReactNode[] = [];
  for (let i = first; i <= last; i++) {
    const tok = TOKENS[i];
    const lit = inAyah(i);
    const isCurrent = i === current;
    const mistake = marks.get(i);
    if (i > first) children.push(<Gap key={`g${i}`} centered={centered} min={fontSize * GAP_EM} tint={lit && inAyah(i - 1) ? t.ayahTint : undefined} gap={fontSize * 0.32} />);
    children.push(
      <View key={i} style={[styles.word, { height, backgroundColor: isCurrent ? t.wordTint : lit ? t.ayahTint : mistake ? t.mistakeTint : undefined }]}>
        <Text allowFontScaling={false} style={[textStyle, isCurrent && { color: t.wordInk }]}>
          {tok.text}
        </Text>
        {mistake ? <View style={[styles.mistake, { backgroundColor: t.mistake, bottom: height * 0.1, height: Math.max(2, fontSize * 0.09), borderRadius: fontSize * 0.05 }]} /> : null}
      </View>,
    );
    if (tok.end) {
      children.push(<Gap key={`m${i}`} centered={centered} min={fontSize * GAP_EM} tint={lit ? t.ayahTint : undefined} gap={fontSize * 0.32} />);
      children.push(
        <View key={`a${i}`} style={{ height, justifyContent: "center", backgroundColor: lit ? t.ayahTint : undefined }}>
          <AyahMarker n={tok.a} size={markerSize} />
        </View>,
      );
    }
  }
  return <View style={{ width, height, flexDirection: ROW, alignItems: "center", justifyContent: "center" }}>{children}</View>;
});

function Gap({ centered, min, tint, gap }: { centered: boolean; min: number; tint?: string; gap: number }) {
  return <View style={centered ? { width: gap, alignSelf: "stretch", backgroundColor: tint } : { flexGrow: 1, minWidth: min, alignSelf: "stretch", backgroundColor: tint }} />;
}

const styles = StyleSheet.create({
  paper: { overflow: "hidden" },
  running: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 6 },
  runningText: { fontFamily: FONT_ARABIC, includeFontPadding: false },
  footer: { alignItems: "center", justifyContent: "center" },
  word: { justifyContent: "center" },
  mistake: { position: "absolute", left: "12%", right: "12%", opacity: 0.75 },
});
