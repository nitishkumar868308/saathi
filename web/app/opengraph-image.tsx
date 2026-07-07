import { ImageResponse } from "next/og";

export const alt = "Apka Saathi — jo kuch nahi bhoolta";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Note: renders on-demand in production (Vercel). Local Windows dev may not
// render next/og due to a native-binary limitation — that's environmental.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          backgroundColor: "#F7F2E9",
          backgroundImage:
            "radial-gradient(circle at 15% 20%, rgba(224,164,88,0.35), transparent 40%), radial-gradient(circle at 85% 80%, rgba(194,90,55,0.25), transparent 45%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 24,
              backgroundColor: "#C25A37",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="46" height="46" viewBox="0 0 100 100">
              <path
                fill="#FBF5EA"
                fillRule="evenodd"
                d="M50 12 C70 12 82 26 82 47 L82 62 C82 79 68 87 50 87 C32 87 18 79 18 62 L18 47 C18 26 30 12 50 12 Z M32 45 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 Z M54 45 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 Z M39.3 42.5 a2.2 2.2 0 1 0 4.4 0 a2.2 2.2 0 1 0 -4.4 0 Z M61.3 42.5 a2.2 2.2 0 1 0 4.4 0 a2.2 2.2 0 1 0 -4.4 0 Z M26.5 57 a3.4 3.4 0 1 0 6.8 0 a3.4 3.4 0 1 0 -6.8 0 Z M66.7 57 a3.4 3.4 0 1 0 6.8 0 a3.4 3.4 0 1 0 -6.8 0 Z M39 60 Q50 70 61 60 Q50 64.5 39 60 Z"
              />
            </svg>
          </div>
          <div style={{ fontSize: 44, fontWeight: 700, color: "#2E2823" }}>
            Apka Saathi
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 78,
            fontWeight: 700,
            color: "#2E2823",
            lineHeight: 1.05,
            letterSpacing: "-2px",
          }}
        >
          <div style={{ display: "flex" }}>Aapka saathi, jo kuch</div>
          <div style={{ display: "flex", gap: 20 }}>
            <span>nahi</span>
            <span style={{ color: "#C25A37" }}>bhoolta.</span>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 36,
            fontSize: 34,
            color: "#6B5F54",
            maxWidth: 900,
          }}
        >
          Documents, dates aur kaam — bina pooche yaad. Never forget what
          matters.
        </div>
      </div>
    ),
    { ...size },
  );
}
