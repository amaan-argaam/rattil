import Svg, { Circle, Path, Rect } from "react-native-svg";

type P = { size?: number; color: string };

export const MicIcon = ({ size = 28, color }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Rect x={9} y={2.5} width={6} height={12} rx={3} fill={color} />
    <Path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5M8.5 21.5h7" stroke={color} strokeWidth={1.8} strokeLinecap="round" fill="none" />
  </Svg>
);

export const StopIcon = ({ size = 26, color }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Rect x={6} y={6} width={12} height={12} rx={2.5} fill={color} />
  </Svg>
);

export const BookIcon = ({ size = 24, color }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5M12 6.5C14 5 17 4.5 20.5 5v13c-3.5-.5-6.5 0-8.5 1.5M12 6.5v13" stroke={color} strokeWidth={1.7} strokeLinejoin="round" />
  </Svg>
);

export const MoonIcon = ({ size = 24, color }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" stroke={color} strokeWidth={1.7} strokeLinejoin="round" />
  </Svg>
);

export const SunIcon = ({ size = 24, color }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={4} stroke={color} strokeWidth={1.7} />
    <Path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
  </Svg>
);

export const InfoIcon = ({ size = 24, color }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.7} />
    <Path d="M12 11v6M12 7.5v.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

export const CloseIcon = ({ size = 24, color }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
  </Svg>
);
