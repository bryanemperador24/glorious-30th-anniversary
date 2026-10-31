// Usage: npm run transcribe -- path/to/video-or-audio
// Extracts audio with FFmpeg, transcribes with Groq Whisper, writes word timestamps to out/<name>.json
import Groq from "groq-sdk";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const input = process.argv[2];
if (!input) {
  console.error("Usage: npm run transcribe -- <file>");
  process.exit(1);
}

const name = path.parse(input).name;
const audio = path.join("out", `${name}.mp3`);
fs.mkdirSync("out", { recursive: true });
execFileSync("ffmpeg", ["-y", "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k", audio], { stdio: "inherit" });

const groq = new Groq();
const result = await groq.audio.transcriptions.create({
  file: fs.createReadStream(audio),
  model: "whisper-large-v3-turbo",
  response_format: "verbose_json",
  timestamp_granularities: ["word", "segment"],
});

const outFile = path.join("out", `${name}.json`);
fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
console.log(`Transcript written to ${outFile}`);
