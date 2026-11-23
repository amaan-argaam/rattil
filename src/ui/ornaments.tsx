/** Hand-drawn SVG ornaments: the page frame, surah header cartouche and ayah rosette. */
import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";
import { FONT_ARABIC, FONT_ARABIC_BOLD, useTheme } from "../theme";
import { toArabicDigits } from "../data/quran";

/** Eight-pointed star (two squares) centred at (cx, cy), outer radius r. */
function star8(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const ang = (Math.PI / 8) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.72;
    pts.push(`${(cx + rad * Math.cos(ang)).toFixed(2)},${(cy + rad * Math.sin(ang)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

/** Small lozenges along a straight segment, as one path. */
function lozenges(x1: number, y1: number, x2: number, y2: number, size: number, step: number): string {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.max(1, Math.floor(len / step));
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const real = len / n;
  let d = "";
  for (let i = 0; i < n; i++) {
    const cx = x1 + ux * real * (i + 0.5);
    const cy = y1 + uy * real * (i + 0.5);
    const a = size;
    const b = size * 0.55;
    // along the segment: long axis a, across: b
    d += `M${(cx + ux * a).toFixed(1)},${(cy + uy * a).toFixed(1)}L${(cx - uy * b).toFixed(1)},${(cy + ux * b).toFixed(1)}L${(cx - ux * a).toFixed(1)},${(cy - uy * a).toFixed(1)}L${(cx + uy * b).toFixed(1)},${(cy - ux * b).toFixed(1)}Z`;
  }
  return d;
}

export const PageFrame = memo(function PageFrame({ width, height, band }: { width: number; height: number; band: number }) {
  const t = useTheme();
  const d = useMemo(() => {
    const o = 1.5;
    const mid = band / 2 + o;
    const ins = band + o;
    const size = band * 0.28;
    const step = band * 1.25;
    const chain =
      lozenges(mid + band, mid, width - mid - band, mid, size, step) +
      lozenges(mid + band, height - mid, width - mid - band, height - mid, size, step) +
      lozenges(mid, mid + band, mid, height - mid - band, size, step) +
      lozenges(width - mid, mid + band, width - mid, height - mid - band, size, step);
    const corners = [
      [mid, mid],
      [width - mid, mid],
      [mid, height - mid],
      [width - mid, height - mid],
    ];
    return { o, mid, ins, chain, corners };
  }, [width, height, band]);

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* outer gold rule */}
      <Rect x={d.o} y={d.o} width={width - 2 * d.o} height={height - 2 * d.o} fill="none" stroke={t.gold} strokeWidth={1.6} />
      {/* band */}
      <Rect x={d.o + 2.5} y={d.o + 2.5} width={width - 2 * d.o - 5} height={height - 2 * d.o - 5} fill="none" stroke={t.goldSoft} strokeWidth={band - 5} opacity={t.night ? 0.35 : 0.45} />
      <Path d={d.chain} fill={t.green} opacity={0.85} />
      {/* inner rules */}
      <Rect x={d.ins} y={d.ins} width={width - 2 * d.ins} height={height - 2 * d.ins} fill="none" stroke={t.green} strokeWidth={1.4} />
      <Rect x={d.ins + 3} y={d.ins + 3} width={width - 2 * d.ins - 6} height={height - 2 * d.ins - 6} fill="none" stroke={t.gold} strokeWidth={0.7} />
      {d.corners.map(([cx, cy], i) => (
        <G key={i}>
          <Path d={star8(cx, cy, band * 0.95)} fill={t.paper} stroke={t.gold} strokeWidth={1.1} />
          <Path d={star8(cx, cy, band * 0.55)} fill={t.green} opacity={0.9} />
          <Circle cx={cx} cy={cy} r={band * 0.16} fill={t.goldSoft} />
        </G>
      ))}
    </Svg>
  );
});

/** Ayah end marker: an eight-pointed rosette with the ayah number. */
export const AyahMarker = memo(function AyahMarker({ n, size, tint }: { n: number; size: number; tint?: string }) {
  const t = useTheme();
  const c = size / 2;
  const digits = toArabicDigits(n);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center", backgroundColor: tint }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Path d={star8(c, c, c * 0.98)} fill="none" stroke={t.gold} strokeWidth={size * 0.045} />
        <Circle cx={c} cy={c} r={c * 0.62} fill={t.paper} stroke={t.green} strokeWidth={size * 0.04} />
      </Svg>
      <Text
        allowFontScaling={false}
        style={{
          fontFamily: FONT_ARABIC_BOLD,
          fontSize: size * (digits.length > 2 ? 0.3 : 0.38),
          lineHeight: size * 0.62,
          color: t.ink,
          includeFontPadding: false,
          textAlign: "center",
          marginTop: size * 0.04,
        }}
      >
        {digits}
      </Text>
    </View>
  );
});

/** Decorated surah header: a framed cartouche with pointed ends and the surah's name. */
export const SurahHeader = memo(function SurahHeader({ name, width, height }: { name: string; width: number; height: number }) {
  const t = useTheme();
  const d = useMemo(() => {
    const h = height * 0.86;
    const y0 = (height - h) / 2;
    const tip = h * 0.55;
    const outer = `M0,${height / 2}L${tip},${y0}L${width - tip},${y0}L${width},${height / 2}L${width - tip},${y0 + h}L${tip},${y0 + h}Z`;
    const p = h * 0.14;
    const inner = `M${p * 1.6},${height / 2}L${tip + p * 0.4},${y0 + p}L${width - tip - p * 0.4},${y0 + p}L${width - p * 1.6},${height / 2}L${width - tip - p * 0.4},${y0 + h - p}L${tip + p * 0.4},${y0 + h - p}Z`;
    const medW = h * 1.05;
    const medL = tip + medW * 0.6;
    const medR = width - medL;
    const chain = lozenges(medL + medW * 0.75, y0 + p * 0.5, medR - medW * 0.75, y0 + p * 0.5, p * 0.32, p * 1.3) + lozenges(medL + medW * 0.75, y0 + h - p * 0.5, medR - medW * 0.75, y0 + h - p * 0.5, p * 0.32, p * 1.3);
    return { outer, inner, chain, medL, medR, r: h * 0.36, cy: height / 2 };
  }, [width, height]);
  return (
    <View style={{ width, height, alignItems: "center", justifyContent: "center" }}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Path d={d.outer} fill={t.green} opacity={t.night ? 0.55 : 0.9} stroke={t.gold} strokeWidth={1.4} />
        <Path d={d.inner} fill={t.paper} stroke={t.gold} strokeWidth={1} />
        <Path d={d.chain} fill={t.gold} opacity={0.75} />
        {[d.medL, d.medR].map((cx, i) => (
          <G key={i}>
            <Path d={star8(cx, d.cy, d.r)} fill={t.green} opacity={0.85} stroke={t.gold} strokeWidth={0.9} />
            <Circle cx={cx} cy={d.cy} r={d.r * 0.38} fill={t.goldSoft} />
          </G>
        ))}
      </Svg>
      <Text allowFontScaling={false} style={{ fontFamily: FONT_ARABIC_BOLD, fontSize: height * 0.42, color: t.ink, includeFontPadding: false, lineHeight: height * 0.8, textAlign: "center" }}>
        {"سورة " + name}
      </Text>
    </View>
  );
});

/** Page number in a small medallion. */
export const PageNumber = memo(function PageNumber({ page, size }: { page: number; size: number }) {
  const t = useTheme();
  return (
    <View style={{ height: size, minWidth: size * 2.2, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size * 2.2} height={size} style={StyleSheet.absoluteFill}>
        <Path
          d={`M0,${size / 2}L${size * 0.45},${size * 0.12}L${size * 1.75},${size * 0.12}L${size * 2.2},${size / 2}L${size * 1.75},${size * 0.88}L${size * 0.45},${size * 0.88}Z`}
          fill="none"
          stroke={t.gold}
          strokeWidth={1}
        />
      </Svg>
      <Text allowFontScaling={false} style={{ fontFamily: FONT_ARABIC, fontSize: size * 0.5, color: t.inkSoft, includeFontPadding: false }}>
        {toArabicDigits(page)}
      </Text>
    </View>
  );
});
