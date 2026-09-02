import {
  affineFromTriangles,
  affineToSvg,
  buildMouthMesh,
  emotionOrDefault,
  getVisemeShape,
  REST_VISEME,
  SEAM_INFLATE,
  inflateTriangle,
  trianglePoints,
  visemeAt,
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
 * Bolti tasveer — ek tasveer jiska muh bole ja rahe text ke saath chalta hai.
 *
 * ⚠️ Muh **asli tasveer ke apne honth se** banta hai: honth ke aas-paas ek chhota
 * triangle mesh banta hai (`buildMouthMesh`) aur har frame par uske point hilte
 * hain. Isliye rang, roshni aur texture hamesha milte hain. Chipkaya hua muh —
 * chahe kitna bhi achha bana ho — har tasveer par ek sticker jaisa dikhta hai,
 * aur wo dekhte hi pakda jaata hai.
 *
 * ⚠️ **Canvas nahi, SVG** — aur ye is component ka sabse zaroori faisla hai.
 * Remotion har frame ka screenshot Chromium se leta hai. Canvas par draw karna
 * ek async kaam hai aur wo us screenshot se race karta hai: nateeja beech-beech
 * me purana ya khaali frame, jo **preview me bilkul nahi dikhta** aur sirf bane
 * hue MP4 me nikalta hai. SVG DOM hai — jo likha hai wahi screenshot me aata
 * hai, har baar. Ye baat andaaze se nahi, naap kar tay hui
 * (`worker/scripts/render-warp.ts`).
 *
 * ⚠️ Yahan koi hisaab nahi hai. Shape, waqt, aur mesh — teeno `@reel/core` me
 * bante hain, jahan unhe ek script se jaancha ja sakta hai. Yahan sirf jodna
 * hai. Hisaab yahan le aane ka matlab hota use sirf render dekh kar jaanchna,
 * aur wo har badlav par ek poora render chalana hota — jo koi nahi karta.
 */

/** Sir ka halka jhukav poora chakkar itne second me karta hai. */
const SWAY_SECONDS = 4.5;
/** Jhukav kitne degree — 1.2 se zyada par sir "hilta hua" nahi, "ghoomta hua" lagta hai. */
const SWAY_DEGREES = 1.2;

export const TalkingPhotoItem: React.FC<ItemComponentProps> = ({ item, assets, localFrame }) => {
  const { fps } = useVideoConfig();
  const src = assetSrc(assets, item.assetId);
  const talking = item.talkingPhoto;

  if (!src) return <MissingAsset item={item} />;

  /*
   * ⚠️ Data na ho to ye ek **aam tasveer** ki tarah dikhti hai, gayab nahi hoti.
   * Ye halat asli hai (purana doc, ya adhoora bana hua item), aur us par khaali
   * frame dikhana sabse bura jawab hota: reel ke beech me ek kaala tukda aata
   * hai aur uski wajah kahin nahi likhi hoti.
   */
  if (!talking) {
    return (
      <Transformed item={item} localFrame={localFrame}>
        <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: objectFitFor(item) }} />
      </Transformed>
    );
  }

  const atSeconds = localFrame / Math.max(1, fps);
  const frame = visemeAt(talking.track, atSeconds);
  const shape = getVisemeShape(frame.viseme) ?? getVisemeShape(REST_VISEME);
  const emotion = emotionOrDefault(talking.emotionId);
  const size = talking.sourceSize;

  const mesh: MeshTriangle[] = shape
    ? buildMouthMesh({
        face: talking.face,
        size,
        shape,
        intensity: frame.intensity,
        emotion,
      })
    : [];

  /*
   * Saans jaisa halka jhukav — har clip me, har emotion par.
   *
   * ⚠️ Bina iske chehra ek tasveer jaisa lagta hai jiska sirf muh chal raha ho,
   * aur wo "zinda" se zyada "toota hua" dikhta hai. Emotion sirf iski raftaar
   * badalta hai, ise band nahi karta — `swaySpeed` kisi bhi emotion par 0 nahi
   * hota.
   */
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
          ⚠️ Poori tasveer sabse pehle, apni poori shakal me. Mesh uske UPAR
          chipakta hai. Iska ek chhupa hua faayda hai: mesh ke tukdon ke beech
          agar kabhi baal bhar ka jhol reh jaaye to wahan yahi asli tasveer
          dikhti hai — koi khaali lakeer nahi.
        */}
        <image href={src} x={0} y={0} width={size.width} height={size.height} />

        <defs>
          {mesh.map((piece, at) => (
            <clipPath key={at} id={`${item.id}-mouth-${at}`} clipPathUnits="userSpaceOnUse">
              {/*
                ⚠️ Phulaya hua triangle — `piece.to` nahi. Bilkul kinare par
                katne se Chromium har tukde ko alag antialias karta hai aur beech
                me aadhe pixel ki lakeer chhod deta hai, jisme peeche wali tasveer
                jhaankti hai — chehre par baariक safed dhaariyan. Matrix phir bhi
                ASLI triangle par hi banti hai (neeche), warna poora mesh apni
                jagah se hat jaata.
              */}
              <polygon points={trianglePoints(inflateTriangle(piece.to, SEAM_INFLATE))} />
            </clipPath>
          ))}
        </defs>

        {mesh.map((piece, at) => {
          const matrix = affineFromTriangles(piece.from, piece.to);
          /*
           * Matrix na bane to wo tukda chhod diya jaata hai — uske neeche asli
           * tasveer pehle se padi hai, isliye wahan kuch gayab nahi hota.
           */
          if (!matrix) return null;
          return (
            <g key={at} clipPath={`url(#${item.id}-mouth-${at})`}>
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
      </svg>
    </Transformed>
  );
};
