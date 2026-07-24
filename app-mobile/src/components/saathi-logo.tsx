import { Image } from "react-native";

/**
 * Asli brand logo (AS + do log + handshake) — app icon image se.
 * Purana terracotta chip + mascot mark ki jagah ye poora logo dikhata hai.
 * size = box, radius = corner (container jaisa do taaki poora bhar jaye).
 */
const LOGO = require("../../assets/images/icon.png");

export default function SaathiLogo({
  size = 40,
  radius,
}: {
  size?: number;
  radius?: number;
}) {
  return (
    <Image
      source={LOGO}
      style={{ width: size, height: size, borderRadius: radius ?? Math.round(size * 0.28) }}
      resizeMode="cover"
    />
  );
}
