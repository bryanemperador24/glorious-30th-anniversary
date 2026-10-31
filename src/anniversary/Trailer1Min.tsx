import React from "react";
import { AbsoluteFill, Easing, Html5Audio, Sequence, interpolate, useCurrentFrame } from "remotion";
import { GoldGlitter, Letterbox, SilkPass, asset } from "./effects";
import { Beat, Clip, HANDLE_IN, HANDLE_OUT } from "./InterviewFilm";
import { PosterTrailer, SHOTS, SHOT_STARTS, TRAILER_FRAMES } from "./PosterTrailer";
import linesJson from "./trailer-1min.json";

// Script option 3 ("From the ashes to the glory"): emotional B&W lines → the turn to colour →
// building lines → hard cut to black → the poster trailer, picked up from its music drop.
const FPS = 30;
const lines = linesJson as Beat[];

const INTRO_BLACK = 15;
const SILK_GAP = 18; // a breath of black under the silk pass before a "silk" line
const PRE_POSTER_BLACK = 12; // hard cut to black after "…the next 30 years."

const timeline = (() => {
  let cursor = INTRO_BLACK;
  return lines.map((b) => {
    if (b.transition === "silk") cursor += SILK_GAP;
    const clipStart = Math.max(0, b.in - HANDLE_IN);
    const frames = Math.round((b.out + HANDLE_OUT - clipStart) * FPS);
    const entry = { beat: b, from: cursor, frames, clipStart };
    cursor += frames;
    return entry;
  });
})();
const lastEnd = timeline[timeline.length - 1].from + timeline[timeline.length - 1].frames;

// The poster trailer starts at its music drop (the curve of the 0).
const DROP_SHOT = SHOTS.findIndex((s) => s.name.includes("DROP"));
if (DROP_SHOT < 0) throw new Error('PosterTrailer has no shot named "DROP"');
const DROP = SHOT_STARTS[DROP_SHOT];
export const POSTER_AT = lastEnd + PRE_POSTER_BLACK;
export const TRAILER_1MIN_FRAMES = POSTER_AT + (TRAILER_FRAMES - DROP);

export const Trailer1Min: React.FC = () => {
  const frame = useCurrentFrame();
  const turn = timeline.find((t) => t.beat.look.colorAt != null)!;
  const colorFrame = turn.from + Math.round((turn.beat.look.colorAt! - turn.clipStart) * FPS);
  const strong = timeline.find((t) => t.beat.id === "t09")!;
  const barsOpen = interpolate(frame, [POSTER_AT, POSTER_AT + 16], [1, 0], {
    easing: Easing.bezier(0.65, 0, 0.35, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const sfx = [
    { src: "shimmer", at: colorFrame - 4, volume: 0.45 },
    ...timeline.filter((t) => t.beat.transition === "silk").map((t) => ({ src: "whoosh-soft", at: t.from - 26, volume: 0.6 })),
    { src: "hit", at: strong.from + 3, volume: 0.45 },
    { src: "riser", at: POSTER_AT - 48, volume: 0.55 },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {timeline.map(({ beat, from, frames, clipStart }, i) => (
        <Sequence key={beat.id} from={from} durationInFrames={frames} name={`${beat.id} ${beat.act}`}>
          <Clip beat={beat} frames={frames} clipStart={clipStart} isFirst={i === 0} />
        </Sequence>
      ))}

      {timeline
        .filter((t) => t.beat.transition === "silk")
        .map((t) => (
          <SilkPass key={t.beat.id} frame={frame} at={t.from - SILK_GAP / 2} dur={50} />
        ))}
      <GoldGlitter frame={frame} seed="turn" start={colorFrame - 6} duration={40} box={{ x: 100, y: 200, w: 1720, h: 700 }} count={200} life={55} rise={1.2} size={[2.5, 10]} />

      <Sequence from={POSTER_AT} durationInFrames={TRAILER_FRAMES - DROP} name="Poster trailer (from the drop)">
        <Sequence from={-DROP} layout="none">
          <PosterTrailer />
        </Sequence>
      </Sequence>

      <Letterbox open={barsOpen} />

      {sfx.map((cue, i) => (
        <Sequence key={i} from={Math.max(0, cue.at)} layout="none">
          <Html5Audio src={asset(`sfx/${cue.src}.wav`)} volume={cue.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
