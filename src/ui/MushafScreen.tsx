import { useKeepAwake } from "expo-keep-awake";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import PagerView from "react-native-pager-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PAGE_COUNT, SURAHS, TOKENS, pageOf } from "../data/quran";
import { REPLAY_URL, clearError, replayWav, startRecitation, stopRecitation, useRecitation } from "../engine/recitation";
import { getSettings, updateSettings, useSettings } from "../state/settings";
import { useTheme } from "../theme";
import { About } from "./About";
import { BookIcon, MicIcon, MoonIcon, StopIcon, SunIcon } from "./icons";
import { IndexSheet } from "./IndexSheet";
import { MushafPage } from "./MushafPage";

/**
 * Pager slots run from page 604 down to page 1, so that, as in a printed Arabic mushaf, the next page comes from
 * the left (swipe left to right) whatever the device's locale.
 */
const slotOf = (page: number) => PAGE_COUNT - page;
const pageAt = (slot: number) => PAGE_COUNT - slot;

/** Pages rendered either side of the one on screen. */
const WINDOW = 1;
/** After a manual swipe, don't pull the reader back for this long. */
const MANUAL_GRACE_MS = 6000;

const KEEP_AWAKE_TAG = "reciting";

function KeepAwake() {
  useKeepAwake(KEEP_AWAKE_TAG);
  return null;
}

export function MushafScreen() {
  const t = useTheme();
  const settings = useSettings();
  const rec = useRecitation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const pager = useRef<PagerView>(null);
  const [page, setPage] = useState(() => Math.min(PAGE_COUNT, Math.max(1, getSettings().page)));
  const [indexOpen, setIndexOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const programmatic = useRef(false);
  const lastManual = useRef(0);

  const barH = 76;
  const geo = useMemo(() => {
    const top = insets.top + 6;
    const availH = height - top - insets.bottom - barH;
    const availW = width - 12;
    // Printed Madani pages are about 0.64 as wide as they are tall; on tall phones use the extra height.
    const w = Math.min(availW, availH * 0.72);
    return { width: w, height: availH, top };
  }, [width, height, insets.top, insets.bottom]);

  const goTo = useCallback((p: number, animated = true) => {
    programmatic.current = true;
    if (animated) pager.current?.setPage(slotOf(p));
    else pager.current?.setPageWithoutAnimation(slotOf(p));
  }, []);

  // Follow the reciter.
  const currentPage = rec.current >= 0 ? pageOf(rec.current) : 0;
  useEffect(() => {
    if (!settings.follow || !currentPage || currentPage === page) return;
    if (Date.now() - lastManual.current < MANUAL_GRACE_MS && rec.status === "listening") return;
    goTo(currentPage, Math.abs(currentPage - page) <= 2);
  }, [currentPage, settings.follow]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSelected = useCallback((e: { nativeEvent: { position: number } }) => {
    const p = pageAt(e.nativeEvent.position);
    if (!programmatic.current) lastManual.current = Date.now();
    programmatic.current = false;
    setPage(p);
    updateSettings({ page: p });
  }, []);

  const mistakesByPage = useMemo(() => {
    const m = new Map<number, string[]>();
    rec.mistakes.forEach((kind, tok) => {
      const p = pageOf(tok);
      if (!m.has(p)) m.set(p, []);
      m.get(p)!.push(`${tok}:${kind}`);
    });
    return m;
  }, [rec.mistakes]);

  const cur = rec.current >= 0 ? TOKENS[rec.current] : null;
  const activeAyah = cur ? `${cur.s}:${cur.a}` : "";

  const onMic = useCallback(() => {
    if (rec.status === "listening") stopRecitation();
    else if (rec.status === "idle" || rec.status === "error") startRecitation(getSettings().tier);
  }, [rec.status]);

  const onMicLong = useCallback(async () => {
    // Testing aid (see replayWav): feeds a recording instead of the microphone. Inert in published releases.
    if (!REPLAY_URL || rec.status !== "idle") return;
    const res = await fetch(`${REPLAY_URL}?t=${Date.now()}`, { cache: "no-store" });
    replayWav(getSettings().tier, new Uint8Array(await res.arrayBuffer()));
  }, [rec.status]);

  useEffect(() => {
    if (rec.status === "error" && rec.error) {
      Alert.alert("Couldn't listen", rec.error, [{ text: "OK", onPress: clearError }]);
    }
  }, [rec.status, rec.error]);

  const status = (() => {
    if (rec.status === "preparing") return rec.progressLabel || "Preparing…";
    if (rec.status === "listening") {
      if (!rec.locked || !cur) return "Listening… recite from anywhere";
      return `${SURAHS[cur.s - 1].tname} ${cur.s}:${cur.a}`;
    }
    if (rec.status === "stopping") return "Finishing…";
    if (rec.mistakes.size > 0) return `${rec.mistakes.size} ${rec.mistakes.size === 1 ? "place" : "places"} to review`;
    return "";
  })();

  const pages = useMemo(() => Array.from({ length: PAGE_COUNT }, (_, i) => pageAt(i)), []);

  return (
    <View style={[styles.root, { backgroundColor: t.desk }]}>
      {rec.status === "listening" ? <KeepAwake /> : null}
      <PagerView
        ref={pager}
        style={{ position: "absolute", left: 0, right: 0, top: geo.top, height: geo.height }}
        initialPage={slotOf(page)}
        offscreenPageLimit={1}
        onPageSelected={onSelected}
      >
        {pages.map((p) => (
          <View key={p} style={styles.slot} collapsable={false}>
            {Math.abs(p - page) <= WINDOW ? (
              <MushafPage
                page={p}
                geo={geo}
                current={cur && currentPage === p ? rec.current : -1}
                activeAyah={cur && currentPage === p ? activeAyah : ""}
                mistakes={(mistakesByPage.get(p) ?? []).join(",")}
              />
            ) : (
              <View style={{ width: geo.width, height: geo.height, backgroundColor: t.paper }} />
            )}
          </View>
        ))}
      </PagerView>

      <View style={[styles.bar, { height: barH, bottom: insets.bottom }]}>
        <Pressable style={styles.side} onPress={() => setIndexOpen(true)} hitSlop={8} accessibilityLabel="Index and settings">
          <BookIcon color={t.chromeInk} size={26} />
        </Pressable>
        {status ? (
          <View style={styles.statusWrap} pointerEvents="none">
            <Text numberOfLines={1} style={[styles.status, { color: t.chromeInk, backgroundColor: t.chrome, borderColor: t.goldSoft }]}>
              {status}
            </Text>
          </View>
        ) : null}
        <View style={styles.center}>
          <Pressable
            onPress={onMic}
            onLongPress={onMicLong}
            accessibilityLabel={rec.status === "listening" ? "Stop listening" : "Start reciting"}
            style={({ pressed }) => [
              styles.mic,
              { backgroundColor: rec.status === "listening" ? t.mistake : t.green, borderColor: t.gold, transform: [{ scale: pressed ? 0.95 : 1 }] },
            ]}
          >
            {rec.status === "preparing" || rec.status === "stopping" ? (
              <ActivityIndicator color="#fff" />
            ) : rec.status === "listening" ? (
              <StopIcon color="#fff" />
            ) : (
              <MicIcon color="#fff" />
            )}
          </Pressable>
          {rec.status === "preparing" && rec.progress > 0 && rec.progress < 1 ? (
            <View style={[styles.progress, { backgroundColor: t.goldSoft }]}>
              <View style={{ width: `${Math.round(rec.progress * 100)}%`, height: "100%", backgroundColor: t.green }} />
            </View>
          ) : null}
        </View>
        <Pressable style={styles.side} onPress={() => updateSettings({ night: !settings.night })} hitSlop={8} accessibilityLabel={settings.night ? "Day mode" : "Night mode"}>
          {settings.night ? <SunIcon color={t.chromeInk} size={26} /> : <MoonIcon color={t.chromeInk} size={26} />}
        </Pressable>
      </View>

      <IndexSheet
        visible={indexOpen}
        onClose={() => setIndexOpen(false)}
        onAbout={() => {
          setIndexOpen(false);
          setAboutOpen(true);
        }}
        onGo={(p) => {
          setIndexOpen(false);
          lastManual.current = Date.now();
          goTo(p, Math.abs(p - page) <= 2);
        }}
      />
      <About visible={aboutOpen} onClose={() => setAboutOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  slot: { flex: 1, alignItems: "center", justifyContent: "flex-start" },
  bar: { position: "absolute", left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 22 },
  side: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  center: { alignItems: "center", justifyContent: "center" },
  statusWrap: { position: "absolute", left: 0, right: 0, bottom: 74, alignItems: "center" },
  status: { fontSize: 13, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1, overflow: "hidden", maxWidth: 280 },
  mic: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", borderWidth: 2.5, elevation: 4 },
  progress: { position: "absolute", bottom: -6, width: 64, height: 3, borderRadius: 2, overflow: "hidden" },
});
