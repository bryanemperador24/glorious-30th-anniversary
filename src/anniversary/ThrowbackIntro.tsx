import React from "react";
import { AbsoluteFill, Easing, Html5Audio, Img, Sequence, interpolate, random, useCurrentFrame } from "remotion";
import { Grain, Letterbox, LETTERBOX, OSKARI, SUB_YELLOW, Vignette, asset } from "./effects";
import { HANDLE_IN } from "./InterviewFilm";
import { SERIF } from "./PosterReveal";
import voJson from "./intro-vo.json";
import photosJson from "./throwback-photos.json";

// Opening throwback (~45s): from black, a wide tilted wall of photos fades up from the centre and
// drifts past the camera. Each row of the wall is one year (that year's three photos in the middle,
// flanked by its neighbours'); the wall scrolls up continuously and the year in the middle rolls over,
// digit by digit, as each row passes the centre. Rows stay black-and-white until 2016; from 2016 the
// wall slowly swings round to tilt the other way while colour comes in. Voice-over from the
// interviews sits over a soft music bed.
// Photos per year live in throwback-photos.json (placeholders from 2016 until the archive arrives).
const PHOTOS = photosJson as Record<string, string[]>;
const FIRST = 1996, LAST = 2026, ROWS = LAST - FIRST;

const BLACK = 30;
const WALL_IN = 50; // the wall fades up out of black
const START = 150; // the scroll gathers speed from here (1996 is on screen until then)
const LAND = 1250; // the scroll eases to a stop on 2026
const HOLD = 120; // 2026 holds
const FADE_OUT = 30;
export const INTRO_FRAMES = LAND + HOLD + FADE_OUT;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Scroll position in rows (0 = 1996): a slow drift before START, then a constant speed with a soft
// start and a soft stop on 2026 — it never pauses on a year.
const POS = (() => {
  const v = Array.from({ length: INTRO_FRAMES + 1 }, (_, f) =>
    f < START ? 0 : Math.min(interpolate(f, [START, START + 45], [0, 1], clamp), interpolate(f, [LAND - 75, LAND], [1, 0], clamp)),
  );
  const total = v.reduce((a, b) => a + b, 0);
  let acc = 0;
  return v.map((x) => (acc += (x * ROWS) / total));
})();
const posAt = (f: number) => POS[Math.max(0, Math.min(POS.length - 1, Math.floor(f)))];
// The year turns over when the scroll is halfway between two rows.
const CHANGES = Array.from({ length: ROWS }, (_, k) => POS.findIndex((p) => p >= k + 0.5));
const yearAt = (f: number) => {
  let k = 0;
  while (k < CHANGES.length && f >= CHANGES[k]) k++;
  return { year: FIRST + k, since: k === 0 ? Infinity : f - CHANGES[k - 1] };
};

// Black-and-white sepia until 2016, full colour by 2025.
const gradeFor = (year: number, bright: number, blur: number) => {
  const c = interpolate(year, [2016, 2025], [0, 1], clamp);
  return `grayscale(${1 - c}) sepia(${0.5 * (1 - c)}) contrast(${1.12 - 0.06 * c}) brightness(${bright * (0.8 + 0.1 * c)}) saturate(${0.75 + 0.15 * c}) blur(${blur}px)`;
};

// ---------- Photo wall ----------
const COLS = 7, TILE_W = 600, TILE_H = 400, GAP = 36, STEP = TILE_H + GAP;
const WALL_W = COLS * TILE_W + (COLS - 1) * GAP;

// The year's three photos sit in the middle columns; the outer columns borrow from the years either side.
const photoFor = (k: number, c: number) => {
  const yr = (dk: number) => PHOTOS[String(FIRST + Math.min(ROWS, Math.max(0, k + dk)))];
  if (c < 2) return yr(-1)[c + 1];
  if (c > 4) return yr(1)[c - 5];
  return yr(0)[c - 2];
};

const Wall: React.FC<{ f: number; pos: number }> = ({ f, pos }) => {
  const near = Math.round(pos);
  // Camera: a slow diagonal drift and push. From 2016 the wall swings round to tilt the other way.
  const turn = interpolate(FIRST + pos, [2015.5, 2019.5], [0, 1], { ...clamp, easing: Easing.inOut(Easing.sin) });
  const rotY = interpolate(turn, [0, 1], [-10, 10]);
  const rotZ = interpolate(turn, [0, 1], [-3, 3]);
  const driftX = interpolate(f, [0, INTRO_FRAMES], [260, -260]) * (1 - 2 * turn);
  const zoom = interpolate(f, [0, INTRO_FRAMES], [0.94, 1.06]);
  const tiles = [];
  for (let k = near - 3; k <= near + 3; k++) {
    if (k < -1 || k > ROWS + 1) continue;
    for (let c = 0; c < COLS; c++) {
      const i = k * COLS + c;
      const year = FIRST + Math.min(ROWS, Math.max(0, k));
      const colour = interpolate(year, [2016, 2025], [0, 1], clamp);
      // The first rows fade up from the centre outward; later rows are already there as they scroll in.
      const dist = Math.hypot(c - (COLS - 1) / 2, k);
      const t0 = BLACK + dist * 8 + random(`a${i}`) * 10;
      const appear = interpolate(f, [t0, t0 + 26], [0, 1], clamp);
      const bob = Math.sin(f / 45 + random(`b${i}`) * 6.28) * 18;
      const flicker = 1 - (1 - colour) * 0.08 * random(`fl${i}-${Math.floor(f / 2)}`);
      tiles.push(
        <div
          key={i}
          style={{
            position: "absolute",
            left: 960 - WALL_W / 2 + c * (TILE_W + GAP),
            top: 540 - TILE_H / 2 + (k - pos) * STEP,
            width: TILE_W,
            height: TILE_H,
            overflow: "hidden",
            opacity: appear * flicker,
            transform: `translateZ(${bob + (1 - appear) * -160}px)`,
            boxShadow: "0 18px 40px rgba(0,0,0,0.6)",
          }}
        >
          <Img
            src={asset(photoFor(k, c))}
            style={{ width: "100%", height: "100%", objectFit: "cover", filter: gradeFor(year, 1, 0) }}
          />
        </div>,
      );
    }
  }
  return (
    <AbsoluteFill style={{ perspective: 1700, perspectiveOrigin: "50% 45%" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          transform: `translateX(${driftX}px) scale(${zoom}) rotateX(16deg) rotateY(${rotY}deg) rotateZ(${rotZ}deg)`,
        }}
      >
        {tiles}
      </div>
    </AbsoluteFill>
  );
};

// Out-of-focus dust drifting up in front of everything.
const Dust: React.FC<{ f: number }> = ({ f }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    {Array.from({ length: 34 }, (_, i) => {
      const speed = 0.25 + random(`ds${i}`) * 0.6;
      const size = 3 + random(`dz${i}`) * 9;
      const x = random(`dx${i}`) * 1920 + 30 * Math.sin(f / 90 + i);
      const y = 1180 - ((random(`dy${i}`) * 1300 + f * speed) % 1300);
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: x,
            top: y,
            width: size,
            height: size,
            borderRadius: "50%",
            background: "rgba(255,226,170,0.9)",
            filter: `blur(${1 + size / 4}px)`,
            opacity: 0.12 + random(`do${i}`) * 0.3,
          }}
        />
      );
    })}
  </AbsoluteFill>
);

// ---------- Year ----------
// Odometer: each digit sits in its own window and only the digits that change roll up — 1996 → 1997
// moves just the last digit, 1999 → 2000 rolls all four, the ones digit leading.
const ROLL = 18; // frames per digit roll
const DIGIT: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  textAlign: "center",
  background: "linear-gradient(180deg, #fff3d6 0%, #E0C498 50%, #a8792e 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  WebkitTextFillColor: "transparent",
};
const WINDOW_MASK = "linear-gradient(180deg, transparent 0%, #000 18%, #000 82%, transparent 100%)";

const Year: React.FC<{ f: number }> = ({ f }) => {
  const { year, since } = yearAt(f);
  const prev = String(year - 1), cur = String(year);
  const firstIn = interpolate(f, [BLACK + 40, BLACK + 75], [0, 1], clamp);
  const out = interpolate(f, [INTRO_FRAMES - FADE_OUT, INTRO_FRAMES - 4], [1, 0], clamp);
  const landed = year === LAST;
  const glow = landed ? interpolate(since, [0, 10, 60], [0, 1, 0.4], clamp) : 0;
  const scale = landed ? interpolate(since, [0, 30], [1, 1.08], { ...clamp, easing: Easing.out(Easing.cubic) }) : 1;
  const H = 250; // digit window height
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: firstIn * out }}>
      <div style={{ position: "absolute", width: 980, height: 440, background: "radial-gradient(ellipse at center, rgba(0,0,0,0.55), transparent 70%)" }} />
      <div
        style={{
          display: "flex",
          fontFamily: SERIF,
          fontStyle: "italic",
          fontSize: 210,
          lineHeight: `${H}px`,
          transform: `scale(${scale})`,
          filter: `drop-shadow(0 0 ${14 + glow * 40}px rgba(224,180,100,${0.35 + glow * 0.5}))`,
        }}
      >
        {[...cur].map((d, i) => {
          const changing = since !== Infinity && prev[i] !== d;
          const delay = (3 - i) * 3; // ones digit first, then tens, hundreds, thousands
          const p = changing ? interpolate(since - delay, [0, ROLL], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) }) : 1;
          return (
            <div key={i} style={{ position: "relative", width: 112, height: H, clipPath: "inset(0px -80px)", WebkitMaskImage: WINDOW_MASK, maskImage: WINDOW_MASK }}>
              {changing && p < 1 ? <div style={{ ...DIGIT, transform: `translateY(${-H * p}px)`, filter: `blur(${4 * p}px)` }}>{prev[i]}</div> : null}
              <div style={{ ...DIGIT, transform: `translateY(${H * (1 - p)}px)`, filter: `blur(${4 * (1 - p)}px)` }}>{d}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ---------- Voice-over and captions ----------
type Vo = { id: string; in: number; out: number; subs: [number, string][] };
const VO_AT: Record<string, number> = { v01: 70, v02: CHANGES[2], v04: CHANGES[11], v03: LAND - 110 };
const VO = (voJson as unknown as Vo[]).map((v) => {
  const at = VO_AT[v.id];
  const frames = Math.round((v.out - v.in) * 30) + 6;
  const subs = v.subs.map(([t, text], k) => ({
    from: at + Math.round((t - v.in) * 30),
    to: k + 1 < v.subs.length ? at + Math.round((v.subs[k + 1][0] - v.in) * 30) : at + frames + 8,
    text,
  }));
  return { ...v, at, frames, subs };
});
const CAPTIONS = [...VO.flatMap((v) => v.subs), { from: 125, to: CHANGES[0] - 5, text: "Where it all began" }];

const MUSIC_VOLUME = 0.17;
const MUSIC_UNDER_VO = 0.09;
const musicVolume = (f: number) => {
  const duck = Math.max(0, ...VO.map((v) => interpolate(f, [v.at - 8, v.at, v.at + v.frames, v.at + v.frames + 14], [0, 1, 1, 0], clamp)));
  const tail = interpolate(f, [INTRO_FRAMES - 45, INTRO_FRAMES - 2], [1, 0], clamp);
  return (MUSIC_VOLUME - (MUSIC_VOLUME - MUSIC_UNDER_VO) * duck) * tail;
};

export const ThrowbackIntro: React.FC = () => {
  const f = useCurrentFrame();
  const pos = posAt(f);
  const wallIn = interpolate(f, [BLACK, BLACK + WALL_IN], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
  const fadeOut = interpolate(f, [INTRO_FRAMES - FADE_OUT, INTRO_FRAMES], [0, 1], clamp);
  const caption = CAPTIONS.find((c) => f >= c.from && f < c.to);
  const colour = interpolate(FIRST + pos, [2016, 2025], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill style={{ opacity: wallIn }}>
        <Wall f={f} pos={pos} />
      </AbsoluteFill>
      <Dust f={f} />
      <Grain frame={f} opacity={0.12 + 0.3 * (1 - colour)} id="grain-throwback" />
      <Vignette strength={0.8 - 0.15 * colour} />
      <Year f={f} />
      <AbsoluteFill style={{ backgroundColor: "#000", opacity: fadeOut }} />
      <Letterbox open={1} />
      {caption ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: LETTERBOX,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: OSKARI,
            fontStyle: "italic",
            fontWeight: 500,
            fontSize: 40,
            color: SUB_YELLOW,
            opacity: interpolate(f, [caption.from, caption.from + 6, caption.to - 6, caption.to], [0, 1, 1, 0], clamp),
          }}
        >
          {caption.text}
        </div>
      ) : null}

      <Html5Audio src={asset("music/intro-bed.wav")} volume={musicVolume} />
      {VO.map((v) => (
        <Sequence key={v.id} from={v.at} durationInFrames={v.frames} layout="none">
          <Html5Audio
            src={asset(`clips/${v.id}.mp4`)}
            startFrom={Math.round(HANDLE_IN * 30) - 1}
            volume={(x) => interpolate(x, [0, 2, v.frames - 4, v.frames], [0, 1, 1, 0], clamp) * (v.id === "v01" ? 1.2 : 1)}
          />
        </Sequence>
      ))}
      <Sequence from={CHANGES[CHANGES.length - 1] - 4} layout="none">
        <Html5Audio src={asset("sfx/shimmer.wav")} volume={0.35} />
      </Sequence>
    </AbsoluteFill>
  );
};
