import React from "react";
import { AbsoluteFill, Easing, OffthreadVideo, Sequence, interpolate, useCurrentFrame } from "remotion";
import beatsJson from "./beats.json";
import { GoldGlitter, Grain, LETTERBOX, Letterbox, OSKARI, SUB_YELLOW, SilkPass, Vignette, asset } from "./effects";
import { PosterReveal, T as POSTER } from "./PosterReveal";

// Must match scripts/make-proxies.mjs
export const HANDLE_IN = 0.15;
export const HANDLE_OUT = 0.35;
const FPS = 30;

export type Beat = {
  id: string;
  act: string;
  file: string;
  in: number;
  out: number;
  transition?: "silk";
  look: { bw: boolean; grain: number; zoom: number; colorAt?: number };
  subs: [number, string][];
};
const beats = beatsJson as Beat[];

const INTRO_BLACK = 30; // pure black before the first scene
const INTRO_FADE = 45; // first scene fades up from black
const PRE_POSTER_BLACK = 18; // hard cut to black after the last word

// Lay the clips end to end. Each proxy starts HANDLE_IN before its "in" point.
const timeline = (() => {
  let cursor = INTRO_BLACK;
  return beats.map((b) => {
    const clipStart = Math.max(0, b.in - HANDLE_IN);
    const frames = Math.round((b.out + HANDLE_OUT - clipStart) * FPS);
    const entry = { beat: b, from: cursor, frames, clipStart };
    cursor += frames;
    return entry;
  });
})();
const lastEnd = timeline[timeline.length - 1].from + timeline[timeline.length - 1].frames;
export const POSTER_START = lastEnd + PRE_POSTER_BLACK;
export const FILM_FRAMES = POSTER_START + POSTER.total;
export const BEAT_STARTS = Object.fromEntries(timeline.map((t) => [t.beat.id, t.from]));

export const Clip: React.FC<{ beat: Beat; frames: number; clipStart: number; isFirst: boolean }> = ({ beat, frames, clipStart, isFirst }) => {
  const frame = useCurrentFrame();
  const sec = clipStart + frame / FPS;
  const { look } = beat;

  // B&W → colour, either fixed or crossfading at `colorAt`.
  const gray = look.colorAt != null ? interpolate(sec, [look.colorAt, look.colorAt + 1.2], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : look.bw ? 1 : 0;
  const grain = look.colorAt != null ? interpolate(gray, [0, 1], [0.15, look.grain]) : look.grain;
  const filter = [
    `grayscale(${gray})`,
    `contrast(${1.08 + 0.14 * gray})`,
    `brightness(${0.97 - 0.02 * gray})`,
    `saturate(${0.68})`,
    `sepia(${0.12 * (1 - gray)})`,
  ].join(" ");

  // Slow push-in over every shot, on top of any punch-in.
  const push = interpolate(frame, [0, frames], [1, 1.045]);
  const fadeUp = isFirst ? interpolate(frame, [0, INTRO_FADE], [0, 1], { extrapolateRight: "clamp" }) : 1;
  const volume = (f: number) =>
    interpolate(f, [0, 4, frames - 6, frames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) *
    (isFirst ? interpolate(f, [0, INTRO_FADE], [0, 1], { extrapolateRight: "clamp" }) : 1);

  const sub = [...beat.subs].reverse().find(([t]) => sec >= t - 0.05);
  const subEnd = beat.out + 0.2;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill style={{ opacity: fadeUp, overflow: "hidden" }}>
        <OffthreadVideo
          src={asset(`clips/${beat.id}.mp4`)}
          volume={volume}
          style={{ width: "100%", height: "100%", filter, transform: `scale(${look.zoom * push})`, transformOrigin: "50% 32%" }}
        />
        <Grain frame={frame} opacity={0.08 + grain * 0.55} id={`grain-${beat.id}`} />
        <Vignette strength={0.5 + 0.2 * gray} />
      </AbsoluteFill>
      {sub && sec <= subEnd ? <Subtitle text={sub[1]} /> : null}
    </AbsoluteFill>
  );
};

// Yellow, italic Oskari, set inside the bottom letterbox bar.
export const Subtitle: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      position: "absolute",
      left: 160,
      right: 160,
      bottom: 0,
      height: LETTERBOX,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      fontFamily: OSKARI,
      fontStyle: "italic",
      fontWeight: 500,
      fontSize: 40,
      lineHeight: 1.2,
      color: SUB_YELLOW,
      textShadow: "0 2px 6px rgba(0,0,0,0.8)",
      zIndex: 10,
    }}
  >
    {text}
  </div>
);

export const InterviewFilm: React.FC = () => {
  const frame = useCurrentFrame();

  // Letterbox stays on through the film, then opens as the poster reveal begins.
  const barsOpen = interpolate(frame, [POSTER_START + 20, POSTER_START + 80], [1, 0], {
    easing: Easing.bezier(0.65, 0, 0.35, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const restoration = timeline.find((t) => t.beat.look.colorAt != null);
  const colorFrame = restoration ? restoration.from + Math.round((restoration.beat.look.colorAt! - restoration.clipStart) * FPS) : -1;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {timeline.map(({ beat, from, frames, clipStart }, i) => (
        <Sequence key={beat.id} from={from} durationInFrames={frames} name={`${beat.id} ${beat.act}`}>
          <Clip beat={beat} frames={frames} clipStart={clipStart} isFirst={i === 0} />
        </Sequence>
      ))}

      <Sequence from={POSTER_START} durationInFrames={POSTER.total} name="Poster reveal">
        <PosterReveal />
      </Sequence>

      {/* Blurred silk rushing past the lens at act changes */}
      {timeline
        .filter((t) => t.beat.transition === "silk")
        .map((t) => (
          <SilkPass key={t.beat.id} frame={frame} at={t.from} dur={44} />
        ))}

      {/* Gold glitter as colour returns, and bursting across the black into the poster */}
      <GoldGlitter frame={frame} seed="restore" start={colorFrame - 6} duration={40} box={{ x: 100, y: 200, w: 1720, h: 700 }} count={200} life={55} rise={1.2} size={[2.5, 10]} />
      <GoldGlitter frame={frame} seed="to-poster" mode="sweep" start={POSTER_START - PRE_POSTER_BLACK + 4} duration={40} box={{ x: 0, y: 380, w: 1920, h: 320 }} count={380} life={50} size={[2.5, 11]} />

      <Letterbox open={barsOpen} />
    </AbsoluteFill>
  );
};
