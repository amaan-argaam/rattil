import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useSettings } from "./src/state/settings";
import { DAY, FONT_ARABIC, FONT_ARABIC_BOLD, FONT_QURAN, NIGHT, ThemeContext } from "./src/theme";
import { MushafScreen } from "./src/ui/MushafScreen";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [loaded] = useFonts({
    [FONT_QURAN]: require("./assets/fonts/AmiriQuran.ttf"),
    [FONT_ARABIC]: require("./assets/fonts/Amiri-Regular.ttf"),
    [FONT_ARABIC_BOLD]: require("./assets/fonts/Amiri-Bold.ttf"),
  });
  const { night } = useSettings();
  const theme = night ? NIGHT : DAY;

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.desk).catch(() => {});
  }, [theme.desk]);
  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  if (!loaded) return null;
  return (
    <SafeAreaProvider>
      <ThemeContext.Provider value={theme}>
        <StatusBar style={night ? "light" : "dark"} />
        <MushafScreen />
      </ThemeContext.Provider>
    </SafeAreaProvider>
  );
}
