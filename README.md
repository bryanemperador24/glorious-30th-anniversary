# another video editor

Toolchain: FFmpeg · Remotion · HyperFrames · Groq.

## One-time setup

Node.js is installed at `~/.local/node`. Add it to your PATH (in `~/.zshrc`):

```bash
export PATH="$HOME/.local/node/bin:$PATH"
```

Put your Groq key (https://console.groq.com/keys) in `.env`:

```
GROQ_API_KEY=gsk_...
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run studio` | Open Remotion Studio (`src/`) |
| `npm run render` | Render the Remotion `HelloWorld` comp to `out/hello.mp4` |
| `cd hyperframes && npm run dev` | Preview the HyperFrames project (HTML → video) |
| `cd hyperframes && npm run render` | Render the HyperFrames project to MP4 |
| `npm run groq:test` | Check the Groq API key works |
| `npm run transcribe -- <file>` | FFmpeg audio extract → Groq Whisper word timestamps → `out/<name>.json` |
