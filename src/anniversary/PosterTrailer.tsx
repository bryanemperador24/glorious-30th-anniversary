import React from "react";
import { AbsoluteFill, Easing, Html5Audio, Img, Sequence, interpolate, useCurrentFrame } from "remotion";
import { GOLD, GoldGlitter, Grain, Vignette, asset } from "./effects";
import { CLOTHS, ClothLayer, Placed, SERIF, THIRTY, THIRTY_BOX, ease, easeInOut, wipe } from "./PosterReveal";

// Trailer cut of the poster: black → silk close-ups and ribbons arriving → close-ups of each element
// (the 30 is only ever seen in pieces) → the full poster lands at 17s and stays alive.
export const BEAT = 15;

type Cam = { z: number; fx: number; fy: number };
type State = {
  thirty?: "hidden" | "full" | "band"; // "band" shows only the ANNIVERSARY strip of the 30 artwork
  form?: number; // 0..1: the 30 condenses out of a blur
  reveal?: [number, number]; // the 30 is uncovered by a light sweep between these shot-local frames
  shines?: [number, number][]; // extra light sweeps over the 30
  years?: number;
  top?: number;
  logos?: number;
  faith?: number;
  date?: number;
  venue?: number;
  allSilk?: boolean; // show every ribbon regardless of its arrival time (close-ups)
  dust?: { x: number; y: number; w: number; h: number }; // gold dust in the air
  dustTempo?: number; // < 1 for slow, drifting sparkle
  dustBurst?: boolean; // dust only for a split second on the cut, then gone
  time?: number; // "2:00PM" on its own (defaults to following `date`)
  logoShine?: { src: string; cx: number; cy: number; w: number; h: number; ranges: [number, number][] }; // light sweeps across a logo
  glowLogo?: boolean; // warm, breathing glow on the G logo
  parts?: { three: number; zero: number; th: number; ann: number }; // shot-local frame each piece of the 30 glows in
};

type Shot = {
  name: string;
  frames: number;
  from: Cam;
  to: Cam;
  camEase?: (t: number) => number;
  state: (t: number, f: number) => State;
  whip?: boolean; // motion blur on the cut
  flash?: boolean; // gold exposure flash on the cut
  fade?: { in?: number; out?: number }; // frames of fade from / to black
  flicker?: number[]; // alternating visible / black run lengths, in frames
  goldOut?: number; // frames of gold flash building at the end of the shot (into the next cut)
  bigFlash?: boolean; // full-screen golden flash on the cut
  sfx?: { src: string; at?: number; volume?: number }[];
};

const ALL: State = { thirty: "full", years: 1, top: 1, logos: 1, faith: 1, date: 1, venue: 1 };
const range = (t: number, a: number, b: number, e = ease) =>
  interpolate(t, [a, b], [0, 1], { easing: e, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
const CENTER: Cam = { z: 1, fx: 960, fy: 540 };

// Cut points, in seconds, taken from the hits in trailer-music.wav (see 30th-anniversary/audio/music).
// 0–5.4 loud intro · 5.4–7.5 quiet dip · 7.53 drop · strong hits 9.3, 11.86, 12.18, 14.88 · fades out 17.5–20.5
// Cut points, in seconds, taken from trailer-music-2.wav (see 30th-anniversary/audio/music).
// Opening hit 0.23 · quiet until ~6 · phrase hits every 3s at 3.42, 6.42, 9.42 ... 21.42 · loud kicks in between.
const CUTS = [0, 0.23, 1.17, 3.42, 4.16, 4.92, 5.97, 7.9, 9.42, 10.86, 12.42, 14.08, 15.42, 16.47, 17.13, 18.42, 19.55, 21.42, 22.6, 35.5];
const F = (sec: number) => Math.round(sec * 30);
const len = (k: number) => F(CUTS[k + 1]) - F(CUTS[k]);
export const MUSIC = "trailer-music-2.wav";
const SFX_GAIN = 0.55; // the music carries the hits; effects sit underneath
const SILK_MOTION = 2.4; // exaggerated drift for the trailer

// The ribbons fade in one after another over the opening wide shot.
const CLOTH_IN = [7, 10, 13, 16, 19, 22, 25, 28];

const G_LOGO = { src: "g-logo.png", cx: 1831, cy: 95, w: 72, h: 81 };
const BCC_LOGO = { src: "bcc-logo.png", cx: 137, cy: 101, w: 125, h: (125 * 300) / 470 };

// A light sweep across the 30 every 2 seconds through the final hold.
const HOLD_SHINES: [number, number][] = Array.from({ length: Math.floor((len(18) - 50) / 60) + 1 }, (_, i) => [10 + i * 60, 50 + i * 60]);

export const SHOTS: Shot[] = [
  { name: "Black", frames: len(0), from: CENTER, to: CENTER, state: () => ({}) },
  {
    name: "Opening hit - WIDE, ribbons fade in",
    frames: len(1),
    from: { z: 1.12, fx: 960, fy: 540 },
    to: { z: 1.07, fx: 960, fy: 540 },
    state: () => ({}),
    sfx: [{ src: "whoosh-soft" }],
  },
  {
    name: "0:01-0:03 Glorious G logo, centred, shining - long hold in the quiet",
    frames: len(2),
    from: { z: 4.6, fx: 1831, fy: 95 },
    to: { z: 4.0, fx: 1831, fy: 95 },
    camEase: (t) => t,
    state: (t) => ({
      logos: range(t, 0, 0.3),
      logoShine: { ...G_LOGO, ranges: [[18, 48], [42, 66]] },
      glowLogo: true,
    }),
    sfx: [{ src: "shine", at: 14, volume: 0.6 }],
  },
  {
    name: "Hit 3.42 - silk close, bright ribbon",
    frames: len(3),
    from: { z: 3.6, fx: 520, fy: 230 },
    to: { z: 3.3, fx: 600, fy: 250 },
    state: () => ({}),
    whip: true,
    sfx: [{ src: "whoosh-fast" }],
  },
  {
    name: "Silk close, blurred foreground",
    frames: len(4),
    from: { z: 2.4, fx: 300, fy: 760 },
    to: { z: 2.2, fx: 380, fy: 740 },
    state: () => ({}),
    whip: true,
    sfx: [{ src: "whoosh-fast" }],
  },
  {
    name: "WIDE - all the silk",
    frames: len(5),
    from: { z: 1.14, fx: 960, fy: 540 },
    to: { z: 1.06, fx: 960, fy: 540 },
    state: () => ({}),
    sfx: [{ src: "whoosh-zoom" }],
  },
  {
    name: "0:06 Swell (DROP) - just the top of the 3, shine with sound",
    frames: len(6),
    from: { z: 4.9, fx: 830, fy: 200 },
    to: { z: 5.6, fx: 830, fy: 198 },
    camEase: (t) => t,
    state: () => ({ thirty: "full", shines: [[8, 40]] }),
    flash: true,
    sfx: [{ src: "hit", volume: 0.7 }, { src: "shine", at: 4 }],
  },
  {
    name: "GLORIOUS CHURCH, pushing in",
    frames: len(7),
    from: { z: 2.7, fx: 976, fy: 80 },
    to: { z: 3.4, fx: 976, fy: 76 },
    camEase: Easing.in(Easing.quad),
    state: (t) => ({ top: range(t, 0.05, 0.4) }),
    whip: true,
    sfx: [{ src: "whoosh-fast" }, { src: "riser", at: len(7) - 48, volume: 0.5 }],
  },
  {
    name: "Hit 9.42 - 1996",
    frames: len(8),
    from: { z: 4.2, fx: 380, fy: 397 },
    to: { z: 3.8, fx: 395, fy: 397 },
    state: (t) => ({ years: range(t, 0, 0.3) }),
    flash: true,
    sfx: [{ src: "hit" }],
  },
  {
    name: "2026",
    frames: len(9),
    from: { z: 4.2, fx: 1536, fy: 397 },
    to: { z: 3.9, fx: 1525, fy: 397 },
    state: (t) => ({ years: range(t, 0, 0.3) }),
    whip: true,
    sfx: [{ src: "whoosh-fast" }],
  },
  {
    name: "Hit 12.42 - Baguio Country Club logo, big, shine",
    frames: len(10),
    from: { z: 6.4, fx: 137, fy: 104 },
    to: { z: 5.9, fx: 137, fy: 104 },
    state: (t) => ({ logos: range(t, 0, 0.25), logoShine: { ...BCC_LOGO, ranges: [[12, 40]] } }),
    whip: true,
    flash: true,
    sfx: [{ src: "hit" }],
  },
  {
    name: "ANNIVERSARY on its own, close",
    frames: len(11),
    from: { z: 3.7, fx: 760, fy: 446 },
    to: { z: 3.7, fx: 1150, fy: 446 },
    camEase: easeInOut,
    state: () => ({ thirty: "band", shines: [[6, 30]] }),
    whip: true,
    sfx: [{ src: "whoosh-fast" }],
  },
  {
    name: "Hit 15.42 - HIS FAITHFULNESS",
    frames: len(12),
    from: { z: 3.0, fx: 930, fy: 700 },
    to: { z: 2.8, fx: 980, fy: 700 },
    state: (t) => ({ thirty: "full", faith: range(t, 0, 0.45, easeInOut) }),
    whip: true,
    flash: true,
    sfx: [{ src: "hit" }],
  },
  {
    name: "Kick 16.47 - DEC 6TH 2026 on its own",
    frames: len(13),
    from: { z: 4.2, fx: 835, fy: 811 },
    to: { z: 3.9, fx: 835, fy: 811 },
    state: (t) => ({ date: range(t, 0, 0.35), time: 0 }),
    whip: true,
    flash: true,
    sfx: [{ src: "hit", volume: 0.8 }],
  },
  {
    name: "FORBES HALL",
    frames: len(14),
    from: { z: 2.7, fx: 991, fy: 920 },
    to: { z: 2.45, fx: 991, fy: 915 },
    state: (t) => ({ venue: range(t, 0, 0.35), dust: { x: 750, y: 880, w: 480, h: 80 }, dustBurst: true }),
    whip: true,
    sfx: [{ src: "whoosh-fast" }],
  },
  {
    name: "Hit 18.42 - 2:00PM on its own",
    frames: len(15),
    from: { z: 4.4, fx: 1188, fy: 811 },
    to: { z: 4.0, fx: 1188, fy: 811 },
    state: (t) => ({ time: range(t, 0, 0.3) }),
    whip: true,
    flash: true,
    sfx: [{ src: "hit" }],
  },
  {
    name: "The 30th anniversary assembles - 3, then 0, then TH, then ANNIVERSARY, each glowing in",
    frames: len(16),
    from: { z: 1.85, fx: 950, fy: 380 },
    to: { z: 2.05, fx: 950, fy: 380 },
    camEase: (t) => t,
    state: () => ({ thirty: "full", parts: { three: 0, zero: 13, th: 26, ann: 38 } }),
    goldOut: 7,
    sfx: [
      { src: "riser", at: len(16) - 48 },
      { src: "hit", at: 0, volume: 0.45 },
      { src: "hit", at: 13, volume: 0.45 },
      { src: "hit", at: 26, volume: 0.45 },
      { src: "hit", at: 38, volume: 0.55 },
    ],
  },
  {
    name: "Hit 21.42 - Big golden flash, FULL POSTER, elements fade in",
    frames: len(17),
    from: { z: 1.5, fx: 960, fy: 470 },
    to: { z: 1, fx: 960, fy: 540 },
    camEase: Easing.bezier(0.12, 0.9, 0.2, 1),
    state: (_, f) => ({
      thirty: "full",
      shines: [[4, 34]],
      years: range(f, 0, 8),
      top: range(f, 4, 12),
      logos: range(f, 4, 12),
      faith: range(f, 6, 18, easeInOut),
      date: range(f, 10, 20),
      venue: range(f, 14, 24),
      dust: THIRTY_BOX,
    }),
    bigFlash: true,
    sfx: [{ src: "boom" }],
  },
  {
    name: "HOLD - everything alive, the 30 shining every 2s, fades out with the music",
    frames: len(18),
    from: { z: 1, fx: 960, fy: 540 },
    to: { z: 1.07, fx: 960, fy: 534 },
    camEase: (t) => t,
    state: () => ({ ...ALL, shines: HOLD_SHINES, dust: THIRTY_BOX }),
  },
];

export const SHOT_STARTS = SHOTS.reduce<number[]>((acc, _, i) => [...acc, i === 0 ? 0 : acc[i - 1] + SHOTS[i - 1].frames], []);
export const TRAILER_FRAMES = SHOT_STARTS[SHOTS.length - 1] + SHOTS[SHOTS.length - 1].frames;

const sweepPos = (local: number, [a, b]: [number, number]) =>
  interpolate(local, [a, b], [-20, 130], { easing: easeInOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" });

const PIECES: Record<"three" | "zero" | "th" | "ann", string[]> = {
  three: ["0% 0%, 56% 0%, 51% 8%, 39% 30%, 44% 40%, 44% 55%, 0% 55%", "0% 74%, 55% 74%, 50% 100%, 0% 100%"],
  zero: ["56% 0%, 100% 0%, 100% 55%, 80% 55%, 80% 32%, 64% 32%, 64% 55%, 44% 55%, 44% 40%, 39% 30%, 51% 8%", "55% 74%, 100% 74%, 100% 100%, 50% 100%"],
  th: ["64% 32%, 80% 32%, 80% 55%, 64% 55%"],
  ann: ["0% 55%, 100% 55%, 100% 74%, 0% 74%"],
};

// The 30 assembling piece by piece: each piece arrives white-hot and glowing, then settles to gold.
const ThirtyParts: React.FC<{ local: number; s: State; frame: number }> = ({ local, s, frame }) => {
  const float = Math.sin(frame / 38) * 4;
  const sweeps = (s.shines ?? []).map((r) => sweepPos(local, r));
  const parts = s.parts!;
  const glow = (key: keyof typeof PIECES) => {
    const age = local - parts[key];
    return {
      age,
      p: interpolate(age, [0, 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      heat: interpolate(age, [0, 3, 18], [1, 1, 0.25], { extrapolateRight: "clamp" }),
    };
  };
  const glowStyle = (p: number, heat: number): React.CSSProperties => ({
    position: "absolute",
    inset: 0,
    opacity: p,
    transform: `scale(${1.06 - 0.06 * p})`,
    filter: `brightness(${1 + heat * 1.2}) drop-shadow(0 0 ${8 + heat * 40}px rgba(255,210,130,${0.35 + heat * 0.6}))`,
  });
  // Full glyphs until ANNIVERSARY lands; then the poster's version (cut out around the word) takes over under the glow.
  const swap = interpolate(local - parts.ann, [0, 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const k = THIRTY.w / 2200; // full-glyph canvas → artwork box, measured against thirty.png
  const glyph: React.CSSProperties = { position: "absolute", left: -248 * k, top: -103 * k, width: 2640 * k, height: 1572 * k };
  return (
    <div style={{ position: "absolute", left: THIRTY_BOX.x, top: THIRTY.top + float, width: THIRTY.w, height: THIRTY_BOX.h }}>
      {(["three", "zero"] as const).map((key) => {
        const g = glow(key);
        if (g.age < 0 || swap >= 1) return null;
        return (
          <div key={`full-${key}`} style={{ ...glowStyle(g.p * (1 - swap), g.heat) }}>
            <Img src={asset(key === "three" ? "three.png" : "zero.png")} style={glyph} />
          </div>
        );
      })}
      {(Object.keys(PIECES) as (keyof typeof PIECES)[]).map((key) => {
        const at = key === "three" || key === "zero" ? parts.ann : parts[key];
        const age = local - at;
        if (age < 0) return null;
        const own = glow(key);
        const p = key === "three" || key === "zero" ? swap : own.p;
        const heat = key === "three" || key === "zero" ? Math.max(own.heat, glow("ann").heat) : own.heat;
        return PIECES[key].map((poly, j) => (
          // Glow on the outer layer so it follows the letter shapes, clip on the inner layer.
          <div
            key={`${key}${j}`}
            style={{
              position: "absolute",
              inset: 0,
              opacity: p,
              transform: `scale(${1.06 - 0.06 * p})`,
              filter: `brightness(${1 + heat * 1.2}) drop-shadow(0 0 ${8 + heat * 40}px rgba(255,210,130,${0.35 + heat * 0.6}))`,
            }}
          >
            <div style={{ position: "absolute", inset: 0, clipPath: `polygon(${poly})` }}>
              <Img src={asset("thirty.png")} style={{ width: "100%", height: "100%" }} />
            </div>
          </div>
        ));
      })}
      {sweeps.map((pos, i) => (
        <div
          key={`sw${i}`}
          style={{
            position: "absolute",
            inset: 0,
            WebkitMaskImage: `url(${asset("thirty.png")})`,
            maskImage: `url(${asset("thirty.png")})`,
            WebkitMaskSize: "100% 100%",
            maskSize: "100% 100%",
            background: `linear-gradient(105deg, transparent ${pos - 12}%, rgba(255,246,220,0.95) ${pos}%, transparent ${pos + 10}%)`,
            mixBlendMode: "screen",
          }}
        />
      ))}
    </div>
  );
};

// The 30 artwork. A light sweep both uncovers it (`reveal`) and glints across it (`shines`).
const ThirtyAt: React.FC<{ local: number; s: State; frame: number }> = ({ local, s, frame }) => {
  const mask = `url(${asset("thirty.png")})`;
  const revealPos = s.reveal ? sweepPos(local, s.reveal) : 200;
  const uncover = `linear-gradient(105deg, #000 ${revealPos - 8}%, transparent ${revealPos + 4}%)`;
  const sweeps = [...(s.reveal ? [revealPos] : []), ...(s.shines ?? []).map((r) => sweepPos(local, r))];
  // Only the ANNIVERSARY strip of the artwork, feathered top and bottom.
  const band = "linear-gradient(180deg, transparent 56.5%, #000 59.5%, #000 71%, transparent 75%)";
  const masks: React.CSSProperties =
    s.thirty === "band"
      ? { WebkitMaskImage: `${uncover}, ${band}`, maskImage: `${uncover}, ${band}`, WebkitMaskComposite: "source-in", maskComposite: "intersect" }
      : { WebkitMaskImage: uncover, maskImage: uncover };
  const float = Math.sin(frame / 38) * 4;

  return (
    <div
      style={{
        position: "absolute",
        left: THIRTY_BOX.x,
        top: THIRTY.top + float,
        width: THIRTY.w,
        height: THIRTY_BOX.h,
        ...masks,
        opacity: s.form != null ? Math.min(1, s.form * 1.6) : 1,
        transform: s.form != null ? `scale(${1.14 - 0.14 * s.form})` : undefined,
        filter: `${s.form != null ? `blur(${(1 - s.form) * 26}px) ` : ""}drop-shadow(0 0 16px rgba(230,190,120,0.3))`,
      }}
    >
      <Img src={asset("thirty.png")} style={{ width: "100%", height: "100%" }} />
      {sweeps.map((pos, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            inset: 0,
            WebkitMaskImage: mask,
            maskImage: mask,
            WebkitMaskSize: "100% 100%",
            maskSize: "100% 100%",
            background: `linear-gradient(105deg, transparent ${pos - 12}%, rgba(255,246,220,0.95) ${pos}%, transparent ${pos + 10}%)`,
            mixBlendMode: "screen",
          }}
        />
      ))}
    </div>
  );
};

// Text and logos rise in, then keep floating gently.
const show = (p: number | undefined, frame: number, phase: number, dist = 16): React.CSSProperties => {
  const v = p ?? 0;
  return {
    opacity: v,
    translate: `0 ${(1 - v) * dist + Math.sin(frame / 34 + phase) * 3}px`,
    filter: v < 1 ? `blur(${(1 - v) * 6}px)` : undefined,
  };
};

// The whole poster world. `frame` is global so the silk and floating keep moving across cuts.
const PosterWorld: React.FC<{ frame: number; local: number; len: number; shotId: number; s: State }> = ({ frame, local, len, shotId, s }) => {
  const cloth = (i: number) => {
    const c = CLOTHS[i];
    const e = s.allSilk ? 1 : range(frame, CLOTH_IN[i], CLOTH_IN[i] + 24, Easing.bezier(0.33, 0, 0.2, 1));
    if (e <= 0) return null;
    const side = c.cx < 960 ? -1 : 1;
    return (
      <div key={i} style={{ position: "absolute", inset: 0, opacity: e, transform: `translate(${side * 60 * (1 - e)}px, ${(1 - e) * 20}px)` }}>
        <ClothLayer c={c} cam={1} frame={frame} motion={SILK_MOTION} />
      </div>
    );
  };

  return (
    <AbsoluteFill>
      {CLOTHS.map((c, i) => (!c.front ? cloth(i) : null))}
      {s.parts ? <ThirtyParts local={local} s={s} frame={frame} /> : s.thirty && s.thirty !== "hidden" ? <ThirtyAt local={local} s={s} frame={frame} /> : null}
      {CLOTHS.map((c, i) => (c.front ? cloth(i) : null))}

      <Placed src="y1996.png" cx={379} cy={397} w={123} style={show(s.years, frame, 0.3)} />
      <Placed src="y2026.png" cx={1536} cy={397} w={120} style={show(s.years, frame, 2.1)} />
      <Placed src="glorious.png" cx={976} cy={71} w={413} style={show(s.top, frame, 1.2, -14)} />
      <Placed
        src="g-logo.png"
        cx={1831}
        cy={95}
        w={72}
        style={{
          ...show(s.logos, frame, 2.8),
          ...(s.glowLogo ? { filter: `drop-shadow(0 0 ${5 + 3 * Math.sin(frame / 9)}px rgba(255,214,140,0.75))` } : {}),
        }}
      />
      <Placed src="bcc-logo.png" cx={137} cy={101} w={125} style={show(s.logos, frame, 0.9)} />
      {s.logoShine
        ? s.logoShine.ranges.map((r, i) => {
            const L = s.logoShine!;
            const pos = sweepPos(local, r);
            return (
              <div
                key={`ls${i}`}
                style={{
                  position: "absolute",
                  left: L.cx - L.w / 2,
                  top: L.cy - L.h / 2,
                  width: L.w,
                  height: L.h,
                  WebkitMaskImage: `url(${asset(L.src)})`,
                  maskImage: `url(${asset(L.src)})`,
                  WebkitMaskSize: "100% 100%",
                  maskSize: "100% 100%",
                  background: `linear-gradient(105deg, transparent ${pos - 14}%, rgba(255,248,226,0.95) ${pos}%, transparent ${pos + 12}%)`,
                  mixBlendMode: "screen",
                  opacity: s.logos ?? 0,
                }}
              />
            );
          })
        : null}
      <Placed src="faithfulness.png" cx={970} cy={686} w={581} style={{ ...wipe(s.faith ?? 0), translate: `0 ${Math.sin(frame / 34 + 1.7) * 3}px` }} />
      <Placed src="date.png" cx={835} cy={811} w={356} style={show(s.date, frame, 0.5)} />
      <div style={{ position: "absolute", left: 1188, top: 811, transform: "translate(-50%, -50%)", fontFamily: SERIF, fontStyle: "italic", fontSize: 60, color: GOLD, whiteSpace: "nowrap", ...show(s.time ?? s.date, frame, 1.4) }}>
        2:00PM
      </div>
      <div style={{ position: "absolute", left: 991, top: 901, transform: "translate(-50%, -50%)", fontFamily: SERIF, fontSize: 32, letterSpacing: "0.3em", color: GOLD, whiteSpace: "nowrap", ...show(s.venue, frame, 2.4) }}>
        FORBES HALL
      </div>
      <Placed src="bcc-text.png" cx={992} cy={937} w={474} style={show(s.venue, frame, 3.1)} />

      {s.dust && s.dustBurst ? (
        <GoldGlitter frame={local} seed={`tr-burst-${shotId}`} start={0} duration={4} box={s.dust} count={70} life={12} />
      ) : s.dust ? (
        // Pre-rolled so the dust is already in the air on the cut
        <GoldGlitter frame={local} seed={`tr-dust-${shotId}`} start={-40} duration={len + 40} box={s.dust} count={Math.round((len + 40) * 2.4)} life={50} tempo={s.dustTempo ?? 1} />
      ) : null}
      {s.reveal && s.thirty === "full" ? (
        <GoldGlitter frame={local} seed={`tr-rev-${shotId}`} mode="sweep" start={s.reveal[0]} duration={s.reveal[1] - s.reveal[0]} box={THIRTY_BOX} count={140} life={34} />
      ) : null}
    </AbsoluteFill>
  );
};

// Black level for a strobe: even runs visible, odd runs black, with a 1-frame soft edge.
const flickerBlack = (runs: number[] | undefined, local: number) => {
  if (!runs) return 0;
  let at = 0;
  for (let k = 0; k < runs.length; k++) {
    if (local < at + runs[k]) {
      const black = k % 2 === 1;
      const edge = Math.min(local - at, at + runs[k] - 1 - local);
      return black ? (edge < 1 ? 0.6 : 1) : edge < 1 && k > 0 ? 0.35 : 0;
    }
    at += runs[k];
  }
  return 0;
};

export const PosterTrailer: React.FC = () => {
  const frame = useCurrentFrame();
  const i = SHOT_STARTS.findIndex((start, k) => frame >= start && (k === SHOTS.length - 1 || frame < SHOT_STARTS[k + 1]));
  const shot = SHOTS[i];
  const local = frame - SHOT_STARTS[i];
  const t = shot.frames > 1 ? local / (shot.frames - 1) : 0;
  const ce = (shot.camEase ?? ease)(t);
  const cam = {
    z: interpolate(ce, [0, 1], [shot.from.z, shot.to.z]),
    fx: interpolate(ce, [0, 1], [shot.from.fx, shot.to.fx]),
    fy: interpolate(ce, [0, 1], [shot.from.fy, shot.to.fy]),
  };
  const whipBlur = shot.whip ? interpolate(local, [0, 5], [10, 0], { extrapolateRight: "clamp" }) : 0;
  const flash = shot.flash ? interpolate(local, [0, 7], [0.55, 0], { extrapolateRight: "clamp" }) : 0;
  // Big golden flash: builds over the end of the outgoing shot, peaks on the cut, then burns off.
  const goldBuild = shot.goldOut ? interpolate(local, [shot.frames - shot.goldOut, shot.frames - 1], [0, 0.9], { extrapolateLeft: "clamp", easing: Easing.in(Easing.quad) }) : 0;
  const goldBurn = shot.bigFlash ? interpolate(local, [0, 4, 20], [1, 0.95, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.quad) }) : 0;
  const gold = Math.max(goldBuild, goldBurn);
  const isBlack = shot.name.startsWith("Black");
  const fadeBlack = Math.max(
    shot.fade?.in ? interpolate(local, [0, shot.fade.in], [1, 0], { extrapolateRight: "clamp" }) : 0,
    shot.fade?.out ? interpolate(local, [shot.frames - shot.fade.out, shot.frames], [0, 1], { extrapolateLeft: "clamp" }) : 0,
    interpolate(frame, [TRAILER_FRAMES - 30, TRAILER_FRAMES - 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    flickerBlack(shot.flicker, local),
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
      {!isBlack ? (
        <AbsoluteFill style={{ filter: whipBlur ? `blur(${whipBlur}px)` : undefined }}>
          <AbsoluteFill style={{ transformOrigin: "0 0", transform: `translate(960px, 540px) scale(${cam.z}) translate(${-cam.fx}px, ${-cam.fy}px)` }}>
            <PosterWorld frame={frame} local={local} len={shot.frames} shotId={i} s={shot.state(t, local)} />
          </AbsoluteFill>
        </AbsoluteFill>
      ) : null}

      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(255,226,160,1) 0%, rgba(224,180,100,0.6) 45%, transparent 80%)", opacity: flash, mixBlendMode: "screen" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, #fffaf0 0%, #ffe2a0 35%, #e0b464 75%, #b8862e 100%)", opacity: gold }} />
      <Vignette />
      <Grain frame={frame} />
      <AbsoluteFill style={{ backgroundColor: "#000", opacity: fadeBlack }} />

      <Html5Audio
        src={asset(`music/${MUSIC}`)}
        volume={(f) => interpolate(f, [TRAILER_FRAMES - 36, TRAILER_FRAMES - 2], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
      />

      {SHOTS.flatMap((s, k) =>
        (s.sfx ?? []).map((cue, j) => (
          <Sequence key={`${k}-${j}`} from={Math.max(0, SHOT_STARTS[k] + (cue.at ?? 0))} layout="none">
            <Html5Audio src={asset(`sfx/${cue.src}.wav`)} volume={(cue.volume ?? 1) * SFX_GAIN} />
          </Sequence>
        )),
      )}
    </AbsoluteFill>
  );
};
