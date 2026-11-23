/** Surah and juz index, plus the few settings the app has. */
import { memo } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SURAHS, pageOfAyah, toArabicDigits } from "../data/quran";
import metaData from "../data/generated/meta.json";
import { updateSettings, useSettings } from "../state/settings";
import { FONT_ARABIC, FONT_ARABIC_BOLD, useTheme } from "../theme";
import { CloseIcon } from "./icons";

const JUZ = (metaData.juzStarts as [number, number][]).map(([s, a], i) => ({ n: i + 1, page: pageOfAyah(s, a) }));
const ITEMS = SURAHS.map((s, i) => ({ ...s, n: i + 1, page: pageOfAyah(i + 1, 1) }));

export const IndexSheet = memo(function IndexSheet({ visible, onClose, onGo, onAbout }: { visible: boolean; onClose: () => void; onGo: (page: number) => void; onAbout: () => void }) {
  const t = useTheme();
  const settings = useSettings();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={[styles.root, { backgroundColor: t.paper, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.top}>
          <Text style={[styles.title, { color: t.ink }]}>Index</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
            <CloseIcon color={t.ink} />
          </Pressable>
        </View>
        <FlatList
          data={ITEMS}
          keyExtractor={(x) => String(x.n)}
          initialNumToRender={20}
          ListHeaderComponent={
            <View>
              <View style={[styles.card, { borderColor: t.goldSoft }]}>
                <Row label="Night mode" value={settings.night} onChange={(v) => updateSettings({ night: v })} />
                <Row label="Turn pages as I recite" value={settings.follow} onChange={(v) => updateSettings({ follow: v })} />
                <Row
                  label="More accurate model (68 MB instead of 25 MB)"
                  value={settings.tier === "full"}
                  onChange={(v) => updateSettings({ tier: v ? "full" : "lite" })}
                />
                <Pressable onPress={onAbout} style={styles.aboutRow}>
                  <Text style={[styles.rowLabel, { color: t.green }]}>About, credits and licences</Text>
                </Pressable>
              </View>
              <Text style={[styles.section, { color: t.inkSoft }]}>Juz</Text>
              <View style={styles.juzWrap}>
                {JUZ.map((j) => (
                  <Pressable key={j.n} onPress={() => onGo(j.page)} style={[styles.juz, { borderColor: t.goldSoft }]}>
                    <Text style={[styles.juzText, { color: t.ink }]}>{toArabicDigits(j.n)}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.section, { color: t.inkSoft }]}>Surahs</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => onGo(item.page)} style={({ pressed }) => [styles.item, { borderColor: t.goldSoft, backgroundColor: pressed ? t.ayahTint : undefined }]}>
              <Text style={[styles.num, { color: t.gold }]}>{item.n}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.tname, { color: t.ink }]}>{item.tname}</Text>
                <Text style={[styles.sub, { color: t.inkSoft }]}>
                  {item.ename} · {item.ayas} ayahs · page {item.page}
                </Text>
              </View>
              <Text style={[styles.arabic, { color: t.ink }]}>{item.name}</Text>
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
});

function Row({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: t.ink }]}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: t.greenSoft, false: t.goldSoft }} thumbColor={value ? t.green : t.paperEdge} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14 },
  title: { fontSize: 22, fontWeight: "600" },
  card: { marginHorizontal: 16, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 4, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, gap: 12 },
  rowLabel: { fontSize: 15, flexShrink: 1 },
  aboutRow: { paddingVertical: 12 },
  section: { fontSize: 13, letterSpacing: 1, textTransform: "uppercase", marginHorizontal: 20, marginTop: 14, marginBottom: 6 },
  juzWrap: { flexDirection: "row-reverse", flexWrap: "wrap", paddingHorizontal: 14, gap: 8 },
  juz: { width: 44, height: 40, borderWidth: 1, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  juzText: { fontFamily: FONT_ARABIC_BOLD, fontSize: 17, includeFontPadding: false },
  item: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 14 },
  num: { width: 30, fontSize: 15, fontVariant: ["tabular-nums"], textAlign: "center" },
  tname: { fontSize: 16, fontWeight: "500" },
  sub: { fontSize: 12.5, marginTop: 2 },
  arabic: { fontFamily: FONT_ARABIC, fontSize: 22, includeFontPadding: false },
});
