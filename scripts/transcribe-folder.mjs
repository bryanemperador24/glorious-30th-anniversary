// Usage: node --env-file=.env scripts/transcribe-folder.mjs <videoDir> <outDir>
// Transcribes every video in a folder with Groq Whisper; skips ones already done.
import Groq from "groq-sdk";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const [inDir, outDir] = process.argv.slice(2);
fs.mkdirSync(path.join(outDir, "audio"), { recursive: true });
const groq = new Groq();

for (const file of fs.readdirSync(inDir).filter((f) => /\.(mov|mp4|m4a|wav|mp3)$/i.test(f)).sort()) {
  const name = path.parse(file).name;
  const outFile = path.join(outDir, `${name}.json`);
  if (fs.existsSync(outFile)) continue;
  const audio = path.join(outDir, "audio", `${name}.mp3`);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", path.join(inDir, file), "-vn", "-ac", "1", "-ar", "16000", "-b:a", "48k", audio]);
  const result = await groq.audio.transcriptions.create({
    file: fs.createReadStream(audio),
    model: "whisper-large-v3",
    response_format: "verbose_json",
    timestamp_granularities: ["word", "segment"],
  });
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
  const txt = result.segments.map((s) => `[${s.start.toFixed(1)}] ${s.text.trim()}`).join("\n");
  fs.writeFileSync(path.join(outDir, `${name}.txt`), txt);
  console.log(`done ${file} (${result.language})`);
}
