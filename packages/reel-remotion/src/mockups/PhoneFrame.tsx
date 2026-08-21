import { frameGeometry, requireDevice, visibleTaps, type Mockup } from "@reel/core";
import type React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Phone frame (18.1 / 18.3 / 18.4) — **poora SVG/CSS se**, koi PNG nahi.
 *
 * ⚠️ PNG asset rakhna bahut aasan hota par ek asli khatra hai: wo file render ke
 * bundle me pahunchni chahiye, aur ek din wo miss ho jaati hai — tab video me
 * phone ki jagah khaali dabba aata hai aur render kahin error bhi nahi deta.
 * SVG me wo khatra hai hi nahi.
 *
 * Doosra faayda: har naap `devices.ts` se aata hai, isliye naya device jodna
 * ek data entry hai. Aur frame kisi bhi size par utna hi saaf rehta hai —
 * PNG 4x zoom par phat jaata.
 */
export const PhoneFrame: React.FC<{
  mockup: NonNullable<Mockup>;
  /** Screen ke andar kya dikhega. */
  children: React.ReactNode;
}> = ({ mockup, children }) => {
  const { width: frameWidth, fps } = useVideoConfig();
  /*
   * ⚠️ `useCurrentFrame()` yahan **item-local** frame deta hai, kyunki har item
   * apne `<Sequence>` ke andar render hota hai. Tap ke frame bhi item-local hain
   * (schema me likha hai), isliye dono ek hi paimane par hain — koi offset ka
   * hisaab nahi lagana padta, aur wahi hisaab galat hone ki sabse aam jagah hoti.
   */
  const localFrame = useCurrentFrame();
  const device = requireDevice(mockup.deviceId);

  const color =
    device.colors.find((entry) => entry.id === mockup.colorId) ??
    (device.colors[0] as (typeof device.colors)[number]);

  // Frame ki chaudai project ke frame se — isliye ek hi mockup 1080 aur 540
  // dono par ek jaisa dikhta hai.
  const outerWidth = (mockup.widthPercent / 100) * frameWidth;
  // Geometry screen ki chaudai maangti hai; bezel dono taraf hai.
  const screenWidth = outerWidth / (1 + device.bezelRatio * 2);
  const geometry = frameGeometry(device, screenWidth);

  /*
   * Tilt ke liye `perspective` **parent** par hona chahiye, us element par nahi
   * jo ghoom raha hai. Ek hi element par dono lagane par rotation flat rehti hai
   * aur "3D" ka koi asar nahi dikhta — ye CSS ki sabse aam galtiyon me se hai.
   */
  const tilted = mockup.tiltX !== 0 || mockup.tiltY !== 0;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...(tilted ? { perspective: `${outerWidth * 2.5}px` } : {}),
      }}
    >
      <div
        style={{
          position: "relative",
          width: geometry.outerWidth,
          height: geometry.outerHeight,
          borderRadius: geometry.outerRadius,
          background: `linear-gradient(160deg, ${color.edge} 0%, ${color.body} 22%, ${color.body} 78%, ${color.edge} 100%)`,
          // Shadow frame ke bahar — `drop-shadow` nahi, kyunki dabba thos hai
          // aur `box-shadow` sasta bhi hai aur saaf bhi.
          ...(mockup.shadow
            ? { boxShadow: `0 ${outerWidth * 0.04}px ${outerWidth * 0.09}px rgba(0,0,0,0.55)` }
            : {}),
          ...(tilted
            ? {
                transform: `rotateX(${mockup.tiltX}deg) rotateY(${mockup.tiltY}deg)`,
                transformStyle: "preserve-3d",
              }
            : {}),
        }}
      >
        {/* Screen — yahin item ka media baithta hai. */}
        <div
          style={{
            position: "absolute",
            left: geometry.bezel,
            top: geometry.bezel,
            width: geometry.screenWidth,
            height: geometry.screenHeight,
            borderRadius: geometry.screenRadius,
            overflow: "hidden",
            // Media aane se pehle kaala — bezel ke andar khaali safed bahut
            // bhadka dikhta hai.
            backgroundColor: "#000",
          }}
        >
          {children}

          {/*
           * Tap ke nishaan (18.11) — screen ke **andar**, isliye bezel par kabhi
           * nahi chadhte aur screen ke round kone se apne aap kat jaate hain.
           */}
          {visibleTaps(mockup.taps, localFrame, fps).map((tap, index) => {
            /*
             * Gola phailta hai aur saath me feeka hota hai — asli ungli ka
             * nishaan aisa hi lagta hai. Dono ek saath isliye ki sirf phailne
             * par wo ek badhta hua chhalla lagta hai jo rukta hi nahi.
             */
            const size = geometry.screenWidth * 0.16 * (0.5 + tap.progress);
            return (
              <div
                key={`${tap.x}-${tap.y}-${index}`}
                style={{
                  position: "absolute",
                  left: tap.x * geometry.screenWidth - size / 2,
                  top: tap.y * geometry.screenHeight - size / 2,
                  width: size,
                  height: size,
                  borderRadius: "50%",
                  border: `${Math.max(2, size * 0.06)}px solid rgba(255,255,255,0.9)`,
                  backgroundColor: "rgba(255,255,255,0.18)",
                  opacity: 1 - tap.progress,
                  pointerEvents: "none",
                }}
              />
            );
          })}

          {/*
           * Chamak (glare) — default off.
           *
           * ⚠️ Ye jaan-boojhkar default off hai: screen recording par chamak
           * chadhane se text padhna mushkil ho jaata hai, aur demo video ka
           * poora point hi text padhwana hota hai.
           */}
          {mockup.glare ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(115deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.05) 28%, rgba(255,255,255,0) 46%)",
                pointerEvents: "none",
              }}
            />
          ) : null}
        </div>

        {/*
         * Notch / island — screen ke **upar** khinchte hain, uske pixels kaat
         * kar nahi. Kaat dene par user ka recording upar se kat jaata, jo kabhi
         * koi nahi chahta.
         */}
        {device.cutout !== "none" ? (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: device.cutout === "notch" ? geometry.bezel : geometry.bezel * 1.6,
              width: geometry.cutoutWidth,
              height: geometry.cutoutHeight,
              transform: "translateX(-50%)",
              backgroundColor: color.body,
              borderRadius:
                device.cutout === "notch"
                  ? `0 0 ${geometry.cutoutHeight * 0.6}px ${geometry.cutoutHeight * 0.6}px`
                  : geometry.cutoutHeight,
            }}
          />
        ) : null}
      </div>
    </div>
  );
};
