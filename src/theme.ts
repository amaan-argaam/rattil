import { createContext, useContext } from "react";

export interface Theme {
  night: boolean;
  /** Paper and the margin around it. */
  paper: string;
  paperEdge: string;
  desk: string;
  ink: string;
  inkSoft: string;
  /** Ornament colours: gold line work and the deep green of the frames. */
  gold: string;
  goldSoft: string;
  green: string;
  greenSoft: string;
  /** Following along. */
  ayahTint: string;
  wordTint: string;
  wordInk: string;
  /** Gentle mistake marks: a soft underline and a faint wash, never a change to the text itself. */
  mistake: string;
  mistakeTint: string;
  chrome: string;
  chromeInk: string;
}

export const DAY: Theme = {
  night: false,
  paper: "#FBF4E2",
  paperEdge: "#EFE3C4",
  desk: "#E9DDBF",
  ink: "#1F1A12",
  inkSoft: "#6B5E45",
  gold: "#B08A48",
  goldSoft: "#D9C08A",
  green: "#2F5A4C",
  greenSoft: "#5E8A79",
  ayahTint: "rgba(201, 160, 74, 0.20)",
  wordTint: "rgba(201, 160, 74, 0.42)",
  wordInk: "#1F1A12",
  mistake: "#C0705C",
  mistakeTint: "rgba(192, 112, 92, 0.13)",
  chrome: "rgba(251, 244, 226, 0.97)",
  chromeInk: "#3D3324",
};

export const NIGHT: Theme = {
  night: true,
  paper: "#17140F",
  paperEdge: "#221D15",
  desk: "#0E0C09",
  ink: "#E6DCC3",
  inkSoft: "#9C8E70",
  gold: "#A68A52",
  goldSoft: "#5E4F31",
  green: "#6E9C88",
  greenSoft: "#3F5E52",
  ayahTint: "rgba(196, 160, 86, 0.16)",
  wordTint: "rgba(196, 160, 86, 0.34)",
  wordInk: "#F3EAD2",
  mistake: "#D08A74",
  mistakeTint: "rgba(208, 138, 116, 0.14)",
  chrome: "rgba(23, 20, 15, 0.97)",
  chromeInk: "#E6DCC3",
};

export const ThemeContext = createContext<Theme>(DAY);
export const useTheme = () => useContext(ThemeContext);

export const FONT_QURAN = "AmiriQuran";
export const FONT_ARABIC = "Amiri";
export const FONT_ARABIC_BOLD = "AmiriBold";
