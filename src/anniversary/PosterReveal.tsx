import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { GOLD, GoldGlitter, Grain, Vignette, asset, fadeEnds } from "./effects";

// 1920x1080 @ 30fps. All positions are measured from the 2000x1125 poster, scaled by 0.96.
export const SERIF = '"Times New Roman", Times, serif';

export const ease = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

// 0 → 1 between two frames, eased.
const prog = (frame: number, start: number, end: number, easing = ease) =>
  interpolate(frame, [start, end], [0, 1], {
    easing,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

// Timeline (frames)
export const T = {
  sweepEnd: 75, // opening ribbon pass
  pullBackStart: 20,
  pullBackEnd: 230, // camera settles on the poster layout
  thirtyIn: 150,
  thirtyShine: 215,
  yearsIn: 235,
  topIn: 265,
  faithIn: 295,
  dateIn: 330,
  venueIn: 360,
  shine2: 430,
  total: 540,
};

export type Cloth = {
  src: string;
  cx: number; // center in final layout
  cy: number;
  w: number;
  rot: number;
  flip?: boolean;
  depth: number; // >1 = closer to camera, flies past faster during the pull-back
  opacity?: number;
  phase: number;
  front?: boolean; // in front of the 30
};

// Arrangement roughly following the poster's ribbon composition.
export const CLOTHS: Cloth[] = [
  { src: "cloth.png", cx: 1350, cy: 150, w: 1900, rot: -4, depth: 0.8, phase: 0 },
  { src: "cloth-bright.png", cx: 480, cy: 210, w: 1400, rot: 16, flip: true, depth: 0.9, phase: 1.3 },
  { src: "cloth.png", cx: 1550, cy: 520, w: 1500, rot: 6, depth: 0.85, phase: 2.1 },
  { src: "cloth.png", cx: 420, cy: 840, w: 1400, rot: 20, flip: true, depth: 1.1, phase: 3.0 },
  { src: "cloth-bright.png", cx: 1020, cy: 700, w: 1500, rot: 15, depth: 1, phase: 0.7, front: true, opacity: 0.9 },
  { src: "cloth-blur.png", cx: 1820, cy: 900, w: 2000, rot: -30, depth: 1.6, phase: 1.9, front: true },
  { src: "cloth-blur2.png", cx: -60, cy: 640, w: 1500, rot: 64, depth: 1.7, phase: 2.6, front: true, opacity: 0.9 },
  { src: "cloth-blur.png", cx: 700, cy: 1240, w: 2300, rot: 4, flip: true, depth: 1.9, phase: 0.4, front: true },
];

export const ClothLayer: React.FC<{ c: Cloth; cam: number; frame: number; motion?: number }> = ({ c, cam, frame, motion = 1 }) => {
  // Parallax: deeper layers scale more with the camera, and are pushed out from frame center.
  const s = 1 + (cam - 1) * c.depth;
  const dx = (c.cx - 960) * (s - 1);
  const dy = (c.cy - 540) * (s - 1);
  // Idle drift so the silk never fully stops.
  const t = frame / 30;
  // `motion` scales how far the silk travels (1 = gentle, as in the poster reveal).
  const driftX = Math.sin(t * 0.55 * Math.sqrt(motion) + c.phase) * 18 * c.depth * motion;
  const driftY = Math.cos(t * 0.45 * Math.sqrt(motion) + c.phase * 1.7) * 12 * c.depth * motion;
  const wobble = Math.sin(t * 0.4 * Math.sqrt(motion) + c.phase) * 1.6 * motion;
  const breathe = 1 + Math.sin(t * 0.7 * Math.sqrt(motion) + c.phase) * 0.025 * motion;
  const h = c.w * (1265 / 2600);

  return (
    <Img
      src={asset(c.src)}
      style={{
        position: "absolute",
        width: c.w,
        left: c.cx - c.w / 2,
        top: c.cy - h / 2,
        opacity: c.opacity ?? 1,
        ...fadeEnds,
        transform: `translate(${dx + driftX}px, ${dy + driftY}px) scale(${s}) rotate(${c.rot + wobble}deg) scaleX(${c.flip ? -1 : 1}) scaleY(${breathe})`,
      }}
    />
  );
};

// Element placed by its center and width in poster space.
export const Placed: React.FC<{
  src: string;
  cx: number;
  cy: number;
  w: number;
  style?: React.CSSProperties;
}> = ({ src, cx, cy, w, style }) => (
  <Img
    src={asset(src)}
    style={{ position: "absolute", width: w, left: cx - w / 2, top: cy, transform: "translateY(-50%)", ...style }}
  />
);

// Soft left-to-right wipe used for text reveals.
export const wipe = (p: number): React.CSSProperties => {
  const edge = p * 130 - 15;
  const mask = `linear-gradient(90deg, #000 ${edge - 15}%, transparent ${edge + 15}%)`;
  return { WebkitMaskImage: mask, maskImage: mask };
};

export const riseIn = (p: number, dist = 18): React.CSSProperties => ({
  opacity: p,
  filter: `blur(${(1 - p) * 8}px)`,
  translate: `0 ${(1 - p) * dist}px`,
});

export const THIRTY = { cx: 950, top: 145, w: 719 };

const Thirty: React.FC<{ frame: number }> = ({ frame }) => {
  const p = prog(frame, T.thirtyIn, T.thirtyIn + 70);
  const h = THIRTY.w * (1422 / 2200);
  const shine = (start: number) =>
    interpolate(frame, [start, start + 55], [-60, 160], {
      easing: easeInOut,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  const glow = interpolate(frame, [T.thirtyIn + 40, T.thirtyShine + 30, T.thirtyShine + 90], [0, 1, 0.35], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const mask = `url(${asset("thirty.png")})`;

  const box: React.CSSProperties = {
    position: "absolute",
    left: THIRTY.cx - THIRTY.w / 2,
    top: THIRTY.top,
    width: THIRTY.w,
    height: h,
    transform: `scale(${1.14 - 0.14 * p})`,
    opacity: p,
    filter: `blur(${(1 - p) * 26}px) drop-shadow(0 0 ${24 * glow}px rgba(230,190,120,${0.45 * glow}))`,
  };
  const sheen = (pos: number): React.CSSProperties => ({
    position: "absolute",
    inset: 0,
    WebkitMaskImage: mask,
    maskImage: mask,
    WebkitMaskSize: "100% 100%",
    maskSize: "100% 100%",
    background: `linear-gradient(105deg, transparent ${pos - 14}%, rgba(255,244,214,0.95) ${pos}%, transparent ${pos + 14}%)`,
    mixBlendMode: "screen",
  });

  return (
    <div style={box}>
      <Img src={asset("thirty.png")} style={{ width: "100%", height: "100%" }} />
      <div style={sheen(shine(T.thirtyShine))} />
      <div style={sheen(shine(T.shine2))} />
    </div>
  );
};

export const THIRTY_BOX = { x: THIRTY.cx - THIRTY.w / 2, y: THIRTY.top, w: THIRTY.w, h: THIRTY.w * (1422 / 2200) };

const Glitter: React.FC<{ frame: number }> = ({ frame }) => (
  <>
    {/* Dust gathering as the 30 forms, then riding the two light sweeps */}
    <GoldGlitter frame={frame} seed="thirty" start={T.thirtyIn + 5} duration={70} box={THIRTY_BOX} count={240} life={55} />
    <GoldGlitter frame={frame} seed="shine1" mode="sweep" start={T.thirtyShine} duration={55} box={THIRTY_BOX} count={170} life={40} />
    <GoldGlitter frame={frame} seed="shine2" mode="sweep" start={T.shine2} duration={55} box={THIRTY_BOX} count={120} life={40} />
    {/* Text */}
    <GoldGlitter frame={frame} seed="y1996" start={T.yearsIn} duration={35} box={{ x: 320, y: 370, w: 120, h: 55 }} count={28} size={[1.5, 5]} />
    <GoldGlitter frame={frame} seed="y2026" start={T.yearsIn} duration={35} box={{ x: 1476, y: 370, w: 120, h: 55 }} count={28} size={[1.5, 5]} />
    <GoldGlitter frame={frame} seed="top" start={T.topIn} duration={35} box={{ x: 770, y: 55, w: 413, h: 35 }} count={40} size={[1.5, 5]} />
    <GoldGlitter frame={frame} seed="faith" mode="sweep" start={T.faithIn} duration={50} box={{ x: 680, y: 650, w: 581, h: 75 }} count={70} size={[1.5, 5.5]} />
    <GoldGlitter frame={frame} seed="date" start={T.dateIn} duration={45} box={{ x: 660, y: 780, w: 640, h: 65 }} count={50} size={[1.5, 5]} />
    <GoldGlitter frame={frame} seed="venue" start={T.venueIn} duration={50} box={{ x: 750, y: 885, w: 480, h: 70 }} count={45} size={[1.5, 4.5]} />
  </>
);

export const PosterReveal: React.FC = () => {
  const frame = useCurrentFrame();

  // Camera: starts pushed deep into the silk, pulls back to the poster, then a slow push-in on the hold.
  const pull = prog(frame, T.pullBackStart, T.pullBackEnd, Easing.bezier(0.33, 0, 0.1, 1));
  const hold = interpolate(frame, [T.pullBackEnd, T.total], [1, 1.035], { extrapolateLeft: "clamp" });
  const cam = interpolate(pull, [0, 1], [2.8, 1]) * hold;

  // Fade up from black.
  const fadeIn = prog(frame, 0, 40, Easing.linear);
  // Opening ribbon sweeping right → left across the lens.
  const sweep = prog(frame, 0, T.sweepEnd, easeInOut);

  const years = prog(frame, T.yearsIn, T.yearsIn + 45);
  const top = prog(frame, T.topIn, T.topIn + 40);
  const faith1 = prog(frame, T.faithIn, T.faithIn + 50, easeInOut);
  const date = prog(frame, T.dateIn, T.dateIn + 40);
  const venue = prog(frame, T.venueIn, T.venueIn + 45);

  const back = CLOTHS.filter((c) => !c.front);
  const front = CLOTHS.filter((c) => c.front);
  const holdScale: React.CSSProperties = { transform: `scale(${hold})` };

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
      <AbsoluteFill style={{ opacity: fadeIn }}>
        {back.map((c, i) => (
          <ClothLayer key={`b${i}`} c={c} cam={cam} frame={frame} />
        ))}
        <AbsoluteFill style={holdScale}>
          <Thirty frame={frame} />
        </AbsoluteFill>
        {front.map((c, i) => (
          <ClothLayer key={`f${i}`} c={c} cam={cam} frame={frame} />
        ))}

        {/* Typography sits above the silk, like the poster */}
        <AbsoluteFill style={holdScale}>
          <Placed src="y1996.png" cx={379} cy={397} w={123} style={{ ...riseIn(years), translate: `${(1 - years) * -60}px 0` }} />
          <Placed src="y2026.png" cx={1536} cy={397} w={120} style={{ ...riseIn(years), translate: `${(1 - years) * 60}px 0` }} />

          <Placed src="glorious.png" cx={976} cy={71} w={413} style={{ ...riseIn(top, -14), letterSpacing: 0 }} />
          <Placed src="g-logo.png" cx={1831} cy={95} w={72} style={riseIn(top)} />
          <Placed src="bcc-logo.png" cx={137} cy={101} w={125} style={riseIn(top)} />

          <Placed src="faithfulness.png" cx={970} cy={686} w={581} style={wipe(faith1)} />

          <Placed src="date.png" cx={835} cy={811} w={356} style={riseIn(date)} />
          <div
            style={{
              position: "absolute",
              left: 1188,
              top: 811,
              transform: "translate(-50%, -50%)",
              fontFamily: SERIF,
              fontStyle: "italic",
              fontSize: 60,
              color: GOLD,
              whiteSpace: "nowrap",
              ...riseIn(prog(frame, T.dateIn + 10, T.dateIn + 50)),
            }}
          >
            2:00PM
          </div>

          <div
            style={{
              position: "absolute",
              left: 991,
              top: 901,
              transform: "translate(-50%, -50%)",
              fontFamily: SERIF,
              fontSize: 32,
              letterSpacing: "0.3em",
              color: GOLD,
              whiteSpace: "nowrap",
              ...riseIn(venue),
            }}
          >
            FORBES HALL
          </div>
          <Placed src="bcc-text.png" cx={992} cy={937} w={474} style={riseIn(prog(frame, T.venueIn + 10, T.venueIn + 55))} />
        </AbsoluteFill>

        {/* Opening sweep: one huge out-of-focus ribbon passing the lens */}
        <Img
          src={asset("cloth-blur.png")}
          style={{
            position: "absolute",
            width: 4200,
            left: -1100,
            top: -500,
            opacity: interpolate(sweep, [0, 0.15, 0.8, 1], [0, 1, 1, 0]),
            ...fadeEnds,
            transform: `translateX(${interpolate(sweep, [0, 1], [1800, -2600])}px) rotate(-12deg)`,
          }}
        />
      </AbsoluteFill>

      {/* Gold glitter on the 30 and each line of text */}
      <AbsoluteFill style={holdScale}>
        <Glitter frame={frame} />
      </AbsoluteFill>

      {/* Vignette + grain to match the poster's texture */}
      <Vignette />
      <Grain frame={frame} />
    </AbsoluteFill>
  );
};
