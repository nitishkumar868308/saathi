import { affineFromTriangles, affineToSvg, trianglePoints, type Point } from "@reel/core";
import type React from "react";
import { Composition } from "remotion";

/**
 * Spike: kya SVG ka triangle mesh Chromium ke screenshot me sach me kheenchta hai?
 *
 * ⚠️ Ye poore "bolti tasveer" feature ka darwaza hai. Muh asli tasveer ke apne
 * honth se banega — landmarks se ek mesh, jo har frame par hilta hai. Wo poora
 * raasta is ek baat par tika hai: `clip-path` + `<image transform>` Remotion ke
 * liye theek se render hota hai ya nahi.
 *
 * Ye baat baad me pata chalna sabse mehnga hota — tab tak visemes, landmarks,
 * panel, sab bane hue hote. Isliye sabse pehle, aur **naapa hua**, andaaze se
 * nahi.
 *
 * ⚠️ Ye Root `packages/reel-remotion` wale asli Root se **alag** hai, aur wo
 * jaan-boojhkar hai. Spike ke liye wahan ek composition jodne ka matlab hota:
 * chalti hui cheez ko chhoona, aur har asli render ke bundle me ek bekaar ki
 * composition le jaana.
 */

export const WARP_COMPOSITION_ID = "Warp";

export interface WarpProps {
  /** Test tasveer — data URI. Aadha kaala (baayan), aadha safed (daayan). */
  imageUrl: string;
  /** `false` = jaisi hai. `true` = kaala hissa aadha simat jaata hai. */
  warp: boolean;
}

/** Frame ka naap — script bhi yahi maanta hai, isliye ek hi jagah likha hai. */
export const WARP_SIZE = 200;

/** Warp par seema upar yahan jaati hai (chaudai ka anupaat). */
export const CUT_TOP = 0.25;
/** ...aur neeche yahan. Dono alag hone se hi har triangle ka transform alag banta hai. */
export const CUT_BOTTOM = 0.75;

/**
 * Do khade tukde, har ek do triangle ka.
 *
 * Bina warp: kaala 0..50%, safed 50%..100% — seema seedhi, beech me.
 * Warp ke saath: seema **tirchi** ho jaati hai — upar 25% par, neeche 75% par.
 *
 * ⚠️ Seema ka tircha hona is spike ki jaan hai, aur pehla tarika (seedhi seema)
 * galat tha. Seedhi seema par ek tukde ke DONO triangle ka transform bilkul ek
 * jaisa nikalta hai — yaani wo halat test hoti hi nahi jo asli muh me har frame
 * par hoti hai (jahan har triangle apni disha me hilta hai). Aur seam theek usi
 * halat me aati hai: do bagal wale triangle jab alag-alag kheenche jaate hain.
 *
 * Tirchi seema par quad→quad ka naata affine reh hi nahi jaata, isliye dono
 * triangle ko alag matrix milti hai — bilkul jaisa asli mesh me hoga.
 */
function strips(warp: boolean): { from: [Point, Point, Point]; to: [Point, Point, Point] }[] {
  const S = WARP_SIZE;
  const mid = S / 2;
  const top = warp ? S * CUT_TOP : mid;
  const bottom = warp ? S * CUT_BOTTOM : mid;

  const quad = (
    sx0: number,
    sx1: number,
    /** Destination ki baayin seema — upar aur neeche. */
    d0Top: number,
    d0Bottom: number,
    /** ...aur daayin. */
    d1Top: number,
    d1Bottom: number,
  ): { from: [Point, Point, Point]; to: [Point, Point, Point] }[] => [
    {
      from: [
        { x: sx0, y: 0 },
        { x: sx1, y: 0 },
        { x: sx0, y: S },
      ],
      to: [
        { x: d0Top, y: 0 },
        { x: d1Top, y: 0 },
        { x: d0Bottom, y: S },
      ],
    },
    {
      from: [
        { x: sx1, y: 0 },
        { x: sx1, y: S },
        { x: sx0, y: S },
      ],
      to: [
        { x: d1Top, y: 0 },
        { x: d1Bottom, y: S },
        { x: d0Bottom, y: S },
      ],
    },
  ];

  return [
    ...quad(0, mid, 0, 0, top, bottom),
    ...quad(mid, S, top, bottom, S, S),
  ];
}

const Warp: React.FC<WarpProps> = ({ imageUrl, warp }) => {
  const pieces = strips(warp);

  return (
    <svg
      width={WARP_SIZE}
      height={WARP_SIZE}
      viewBox={`0 0 ${WARP_SIZE} ${WARP_SIZE}`}
      style={{ backgroundColor: "#7f7f7f" }}
    >
      {/*
        ⚠️ Peeche saada bhoora (mid-gray) hai, kaala ya safed nahi. Agar mesh
        render hi na ho to frame is bhoore rang ka nikalta hai — aur wo naap me
        na kaala ginn'ta hai na safed. Kaala background rakhne par "mesh laga hi
        nahi" aur "kaala hissa hai" ek jaise dikhte, aur test jhooth bol deta.
      */}
      <defs>
        {pieces.map((piece, at) => (
          <clipPath key={at} id={`tri-${at}`}>
            <polygon points={trianglePoints(piece.to)} />
          </clipPath>
        ))}
      </defs>

      {pieces.map((piece, at) => {
        const matrix = affineFromTriangles(piece.from, piece.to);
        if (!matrix) return null;
        return (
          <g key={at} clipPath={`url(#tri-${at})`}>
            <image
              href={imageUrl}
              x={0}
              y={0}
              width={WARP_SIZE}
              height={WARP_SIZE}
              preserveAspectRatio="none"
              transform={affineToSvg(matrix)}
            />
          </g>
        );
      })}
    </svg>
  );
};

export const WarpRoot: React.FC = () => (
  <Composition
    id={WARP_COMPOSITION_ID}
    component={Warp}
    width={WARP_SIZE}
    height={WARP_SIZE}
    fps={30}
    durationInFrames={1}
    defaultProps={{ imageUrl: "", warp: false } satisfies WarpProps}
  />
);
