import { Composition } from "remotion";
import { HelloWorld } from "./HelloWorld";
import { FILM_FRAMES, InterviewFilm } from "./anniversary/InterviewFilm";
import { PosterReveal, T } from "./anniversary/PosterReveal";
import { PosterTrailer, TRAILER_FRAMES } from "./anniversary/PosterTrailer";
import { TRAILER_1MIN_FRAMES, Trailer1Min } from "./anniversary/Trailer1Min";
import { TRAILER_DITO_FRAMES, TrailerDito } from "./anniversary/TrailerDito";
import { INTRO_FRAMES, ThrowbackIntro } from "./anniversary/ThrowbackIntro";

// 1280x720 draft of a 1920x1080 composition (Remotion's --scale can't hit 720 exactly).
const PosterTrailer720: React.FC = () => (
  <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, overflow: "hidden", transform: "scale(0.6666667)", transformOrigin: "0 0" }}>
    <PosterTrailer />
  </div>
);

const Trailer1Min720: React.FC = () => (
  <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, overflow: "hidden", transform: "scale(0.6666667)", transformOrigin: "0 0" }}>
    <Trailer1Min />
  </div>
);

const TrailerDito720: React.FC = () => (
  <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, overflow: "hidden", transform: "scale(0.6666667)", transformOrigin: "0 0" }}>
    <TrailerDito />
  </div>
);

const ThrowbackIntro720: React.FC = () => (
  <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, overflow: "hidden", transform: "scale(0.6666667)", transformOrigin: "0 0" }}>
    <ThrowbackIntro />
  </div>
);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="ThrowbackIntro" component={ThrowbackIntro} durationInFrames={INTRO_FRAMES} fps={30} width={1920} height={1080} />
      <Composition id="ThrowbackIntro720" component={ThrowbackIntro720} durationInFrames={INTRO_FRAMES} fps={30} width={1280} height={720} />
      <Composition id="TrailerDito" component={TrailerDito} durationInFrames={TRAILER_DITO_FRAMES} fps={30} width={1920} height={1080} />
      <Composition id="TrailerDito720" component={TrailerDito720} durationInFrames={TRAILER_DITO_FRAMES} fps={30} width={1280} height={720} />
      <Composition id="Trailer1Min" component={Trailer1Min} durationInFrames={TRAILER_1MIN_FRAMES} fps={30} width={1920} height={1080} />
      <Composition id="Trailer1Min720" component={Trailer1Min720} durationInFrames={TRAILER_1MIN_FRAMES} fps={30} width={1280} height={720} />
      <Composition
        id="PosterTrailer720"
        component={PosterTrailer720}
        durationInFrames={TRAILER_FRAMES}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="PosterTrailer"
        component={PosterTrailer}
        durationInFrames={TRAILER_FRAMES}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="InterviewFilm"
        component={InterviewFilm}
        durationInFrames={FILM_FRAMES}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="PosterReveal"
        component={PosterReveal}
        durationInFrames={T.total}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="HelloWorld"
        component={HelloWorld}
        durationInFrames={90}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ title: "Hello from Remotion" }}
      />
    </>
  );
};
