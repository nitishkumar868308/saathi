import {
  SEAM_INFLATE,
  affineFromTriangles,
  affineToSvg,
  blinkAt,
  browLiftAt,
  buildEyeMesh,
  buildMouthMesh,
  emotionOrDefault,
  inflateTriangle,
  mouthOpening,
  trianglePoints,
  visemeStateAt,
  type MeshTriangle,
} from "@reel/core";
import type React from "react";
import { useVideoConfig } from "remotion";

import { assetSrc } from "../assets";
import type { ItemComponentProps } from "../components";
import { objectFitFor } from "../FitLayer";
import { MissingAsset } from "../MissingAsset";
import { Transformed } from "../Transformed";

/**
 * Bolti tasveer — ek tasveer jiska chehra bole ja rahe text ke saath chalta hai.
 *
 * ⚠️ **"Zinda" dikhna muh se nahi aata**, aur ye is component ka sabse zaroori
 * sabak hai. Pehle yahan sirf muh chalta tha, aur nateeja saaf tha: chehra bolta
 * hua nahi lagta tha, rabar jaisa lagta tha. Char cheezein wo farak banati hain,
 * aur chaaron yahan hain:
 *
 *   1. **Palak jhapakna** — jo chehra kabhi nahi jhapakta wo turant murda lagta
 *      hai, chahe lip sync bilkul theek ho.
 *   2. **Muh ke andar andhera** — iske bina khula muh sirf khinchi hui khaal
 *      hota hai. Andhera hi batata hai ki muh khula hai, lamba nahi hua.
 *   3. **Shape ke beech narm safar** — muh ek shape se doosre par jhatke se
 *      koodne par flipbook jaisa lagta hai (`visemeStateAt`).
 *   4. **Bhaunh aur saans jaisa jhukav** — bolte waqt zor wale hisson par.
 *
 * ⚠️ **Canvas nahi, SVG.** Remotion har frame ka screenshot Chromium se leta hai;
 * canvas par draw karna async hai aur us screenshot se race karta hai — nateeja
 * beech-beech me purana ya khaali frame, jo preview me bilkul nahi dikhta aur
 * sirf bane hue MP4 me nikalta hai. Ye baat naap kar tay hui
 * (`worker/scripts/render-warp.ts`).
 *
 * ⚠️ Yahan koi hisaab nahi hai — shape, waqt, mesh, palak, sab `@reel/core` me
 * bante hain jahan unhe ek script se jaancha ja sakta hai. Yahan sirf jodna hai.
 */

/** Sir ka halka jhukav poora chakkar itne second me karta hai. */
const SWAY_SECONDS = 4.5;
/** Jhukav kitne degree — 1.2 se zyada par sir "hilta hua" nahi, "ghoomta hua" lagta hai. */
const SWAY_DEGREES = 1.2;
/** Muh ke andar ka andhera kitna gehra — poore kaale par wo ek chhed jaisa dikhta hai. */
const MOUTH_DARK = 0.72;

/** Ek mesh ko SVG me — clip + kheenchi hui tasveer. */
function MeshLayer({
  mesh,
  src,
  size,
  idPrefix,
}: {
  mesh: readonly MeshTriangle[];
  src: string;
  size: { width: number; height: number };
  idPrefix: string;
}) {
  if (mesh.length === 0) return null;
  return (
    <>
      <defs>
        {mesh.map((piece, at) => (
          <clipPath key={at} id={`${idPrefix}-${at}`} clipPathUnits="userSpaceOnUse">
            {/*
              ⚠️ Phulaya hua triangle — `piece.to` nahi. Bilkul kinare par katne se
              Chromium har tukde ko alag antialias karta hai aur beech me aadhe
              pixel ki lakeer chhod deta hai, jisme peeche wali tasveer jhaankti
              hai. Matrix phir bhi ASLI triangle par banti hai, warna poora mesh
              apni jagah se hat jaata.
            */}
            <polygon points={trianglePoints(inflateTriangle(piece.to, SEAM_INFLATE))} />
          </clipPath>
        ))}
      </defs>
      {mesh.map((piece, at) => {
        const matrix = affineFromTriangles(piece.from, piece.to);
        /* Matrix na bane to tukda chhod do — neeche asli tasveer pehle se padi hai. */
        if (!matrix) return null;
        return (
          <g key={at} clipPath={`url(#${idPrefix}-${at})`}>
            <image
              href={src}
              x={0}
              y={0}
              width={size.width}
              height={size.height}
              transform={affineToSvg(matrix)}
            />
          </g>
        );
      })}
    </>
  );
}

export const TalkingPhotoItem: React.FC<ItemComponentProps> = ({ item, assets, localFrame }) => {
  const { fps } = useVideoConfig();
  const src = assetSrc(assets, item.assetId);
  const talking = item.talkingPhoto;

  if (!src) return <MissingAsset item={item} />;

  /*
   * ⚠️ Data na ho to ye ek **aam tasveer** ki tarah dikhti hai, gayab nahi hoti.
   * Ye halat asli hai (purana doc, ya adhoora bana hua item), aur us par khaali
   * frame dikhana sabse bura jawab hota: reel ke beech me ek kaala tukda aata hai
   * aur uski wajah kahin nahi likhi hoti.
   */
  if (!talking) {
    return (
      <Transformed item={item} localFrame={localFrame}>
        <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: objectFitFor(item) }} />
      </Transformed>
    );
  }

  const atSeconds = localFrame / Math.max(1, fps);
  const { shape, intensity } = visemeStateAt(talking.track, atSeconds);
  const emotion = emotionOrDefault(talking.emotionId);
  const size = talking.sourceSize;
  const face = talking.face;

  const mouth = buildMouthMesh({ face, size, shape, intensity, emotion });
  const opening = mouthOpening({ face, size, shape, intensity, emotion });

  /*
   * Palak aur bhaunh.
   *
   * ⚠️ `browLift` me emotion ka apna `brow` bhi judta hai aur bolne ka zor bhi.
   * Sirf emotion se karne par bhaunh poore clip me ek jagah jami rehti hai (yaani
   * ek tasveer jaisi), aur sirf zor se karne par "khush" aur "gambhir" me koi
   * farak hi nahi dikhta.
   */
  const closed = blinkAt(atSeconds);
  const browLift = Math.min(1, Math.max(0, emotion.brow * 4 + browLiftAt(intensity) * 0.6));

  const eyes = [
    buildEyeMesh({
      eye: face.leftEye,
      brow: face.leftBrow,
      size,
      closed,
      browLift,
      eyeOpen: emotion.eye,
    }),
    buildEyeMesh({
      eye: face.rightEye,
      brow: face.rightBrow,
      size,
      closed,
      browLift,
      eyeOpen: emotion.eye,
    }),
  ];

  const swayAngle =
    Math.sin((atSeconds / SWAY_SECONDS) * Math.PI * 2 * emotion.swaySpeed) * SWAY_DEGREES;

  return (
    <Transformed item={item} localFrame={localFrame}>
      <svg
        viewBox={`0 0 ${size.width} ${size.height}`}
        preserveAspectRatio={objectFitFor(item) === "contain" ? "xMidYMid meet" : "xMidYMid slice"}
        style={{
          width: "100%",
          height: "100%",
          transform: `rotate(${swayAngle}deg)`,
          transformOrigin: "50% 85%",
        }}
      >
        {/*
          Poori tasveer sabse pehle, apni poori shakal me. Baaki sab uske upar
          chipakta hai — aur iska ek chhupa hua faayda hai: mesh ke tukdon ke beech
          agar kabhi baal bhar ka jhol reh jaaye to wahan yahi asli tasveer dikhti
          hai, koi khaali lakeer nahi.
        */}
        <image href={src} x={0} y={0} width={size.width} height={size.height} />

        <MeshLayer mesh={mouth} src={src} size={size} idPrefix={`${item.id}-mouth`} />

        {/*
          ⚠️ Andhera muh ke mesh ke BAAD aata hai, pehle nahi. Pehle daalne par
          kheenchi hui khaal us par chadh jaati hai aur wo dikhta hi nahi — jo
          bilkul wahi halat hai jisse bachne ke liye ye jodha gaya tha.
        */}
        {opening ? (
          <polygon
            points={opening.points.map((point) => `${point.x},${point.y}`).join(" ")}
            fill="#160d0d"
            opacity={opening.openness * MOUTH_DARK}
          />
        ) : null}

        {eyes.map((mesh, at) => (
          <MeshLayer
            key={at}
            mesh={mesh}
            src={src}
            size={size}
            idPrefix={`${item.id}-eye${at}`}
          />
        ))}
      </svg>
    </Transformed>
  );
};
