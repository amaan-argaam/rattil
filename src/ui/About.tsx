/** About, credits and licences. */
import Constants from "expo-constants";
import { memo } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TANZIL_NOTICE, TOKENS, ayahTokenRange } from "../data/quran";

const [a0, a1] = ayahTokenRange(73, 4);
const AYAH_73_4 = TOKENS.slice(a0, a1 + 1).map((x) => x.text).join(" ");
import { FONT_QURAN, useTheme } from "../theme";
import { CloseIcon } from "./icons";

const REPO = "https://github.com/amaan-argaam/rattil";

export const About = memo(function About({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const H = ({ children }: { children: string }) => <Text style={[styles.h, { color: t.green }]}>{children}</Text>;
  const P = ({ children }: { children: React.ReactNode }) => <Text style={[styles.p, { color: t.ink }]}>{children}</Text>;
  const A = ({ href, children }: { href: string; children: string }) => (
    <Text style={[styles.p, styles.link, { color: t.green }]} onPress={() => Linking.openURL(href)}>
      {children}
    </Text>
  );
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={[styles.root, { backgroundColor: t.paper, paddingTop: insets.top }]}>
        <View style={styles.top}>
          <Text style={[styles.title, { color: t.ink }]}>About</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
            <CloseIcon color={t.ink} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}>
          <Text style={[styles.app, { color: t.ink }]}>رتّل · Rattil</Text>
          <Text style={[styles.version, { color: t.inkSoft }]}>Version {Constants.expoConfig?.version ?? "?"}</Text>
          <P>
            A free, open-source, ad-free mushaf that listens as you recite, finds your place anywhere in the Quran,
            follows you ayah by ayah and turns the pages for you. Possible memorization mistakes are marked gently.
          </P>
          <P>
            Recognition runs entirely on your phone. Your voice is never recorded, stored or sent anywhere. The only
            network use is a one-time download of the recognition model from Tilawa's official host (tilawa.dev).
          </P>
          <A href={REPO}>Source code (GPL-3.0-or-later)</A>

          <H>Speech recognition: Tilawa</H>
          <P>
            Following and mistake detection are powered by Tilawa (© yazinsai and contributors), an offline,
            streaming Quran recitation engine. The SDK is MIT-licensed.
          </P>
          <A href="https://github.com/yazinsai/tilawa">github.com/yazinsai/tilawa</A>
          <A href="https://tilawa.dev">tilawa.dev</A>
          <P>
            The listener models (spliced-clean and spliced-clean-lite) are released by Tilawa (tilawa.dev) under the
            Creative Commons Attribution 4.0 licence. They are trained and evaluated on tlog by Tarteel (CC-BY) and
            Quranic Universal Ayahs and the QUD alignment benchmark by QUD Technologies (CC-BY), distilled from
            muaalem (obadx/muaalem-model-v3_2, MIT), use the quran-transcript phoneme inventory (obadx, MIT), and
            follow the k2-fsa icefall architecture and export (Apache-2.0). Tilawa's reference text derives from
            Tanzil. Full notices are in Tilawa's NOTICE.md.
          </P>
          <A href="https://github.com/yazinsai/tilawa/blob/main/NOTICE.md">Tilawa NOTICE.md</A>
          <A href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</A>
          <P>Mistake marks are prompts, not verdicts. Tilawa checks memorization (wrong, missed and extra words, skipped passages), not tajweed.</P>

          <H>Quran text: Tanzil</H>
          <P>
            The Quran text is the Tanzil Uthmani text, used verbatim and never altered. Source: Tanzil Project.
          </P>
          <A href="https://tanzil.net">tanzil.net</A>
          <Text style={[styles.notice, { color: t.inkSoft, borderColor: t.goldSoft }]}>{TANZIL_NOTICE}</Text>

          <H>Page layout</H>
          <P>
            Pages follow the 604-page, 15-line Madina mushaf. Page boundaries come from Tanzil's metadata; line
            breaks come from DigitalKhatt (digitalkhatt-js, MIT, © DigitalKhatt contributors). Only the line breaks
            are taken from DigitalKhatt; every word shown is Tanzil's.
          </P>
          <A href="https://github.com/DigitalKhatt/digitalkhatt-js">github.com/DigitalKhatt/digitalkhatt-js</A>

          <H>Fonts</H>
          <P>Amiri Quran and Amiri, © The Amiri Project Authors, SIL Open Font License 1.1.</P>
          <A href="https://github.com/aliftype/amiri">github.com/aliftype/amiri</A>

          <H>Software</H>
          <P>
            ONNX Runtime Web (Microsoft, MIT) · React Native and Expo (MIT) · react-native-webview (MIT) · react-native-audio-api (Software Mansion,
            MIT) · react-native-svg (MIT) · react-native-pager-view (MIT).
          </P>
          <Text style={[styles.dua, { color: t.gold }]}>{AYAH_73_4}</Text>
          <Text style={[styles.version, { color: t.inkSoft, textAlign: "center" }]}>Al-Muzzammil 73:4</Text>
        </ScrollView>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14 },
  title: { fontSize: 22, fontWeight: "600" },
  body: { paddingHorizontal: 22 },
  app: { fontSize: 26, fontWeight: "600", marginTop: 4 },
  version: { fontSize: 13, marginBottom: 10 },
  h: { fontSize: 16, fontWeight: "700", marginTop: 22, marginBottom: 6 },
  p: { fontSize: 14.5, lineHeight: 21, marginBottom: 8 },
  link: { textDecorationLine: "underline" },
  notice: { fontFamily: "monospace", fontSize: 10.5, lineHeight: 14, borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 4 },
  dua: { fontFamily: FONT_QURAN, fontSize: 24, textAlign: "center", marginTop: 28 },
});
