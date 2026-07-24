import Svg, { Path } from "react-native-svg";

/**
 * Saathi mascot mark (React Native).
 * `color` = mark ka rang. Aankhein/muskaan/gaal holes hain (evenodd) jo peeche
 * ka background dikhate hain — isliye terracotta circle pe white mark do.
 * NOTE: asli brand logo (AS + hug + handshake) app-icon me hai; chhote in-app
 * glyph spots ke liye ye simple mark hi rehta hai.
 */
const D =
  "M50 12 C70 12 82 26 82 47 L82 62 C82 79 68 87 50 87 C32 87 18 79 18 62 L18 47 C18 26 30 12 50 12 Z M32 45 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 Z M54 45 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 Z M39.3 42.5 a2.2 2.2 0 1 0 4.4 0 a2.2 2.2 0 1 0 -4.4 0 Z M61.3 42.5 a2.2 2.2 0 1 0 4.4 0 a2.2 2.2 0 1 0 -4.4 0 Z M26.5 57 a3.4 3.4 0 1 0 6.8 0 a3.4 3.4 0 1 0 -6.8 0 Z M66.7 57 a3.4 3.4 0 1 0 6.8 0 a3.4 3.4 0 1 0 -6.8 0 Z M39 60 Q50 70 61 60 Q50 64.5 39 60 Z";

export default function SaathiMark({
  size = 24,
  color = "#FFFFFF",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path d={D} fill={color} fillRule="evenodd" />
    </Svg>
  );
}
