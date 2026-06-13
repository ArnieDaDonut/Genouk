# Sound

## Score-reactive music (no files needed)

When you review a prompt, Genouk **synthesizes** a short musical phrase that matches
the score — it does not load an MP3. This runs entirely offline in the webview via
[Tone.js](https://tonejs.github.io/) (Web Audio), so there's no API key, no network
call, and no latency. See [`src/webviews/jarvis-app/musicEngine.ts`](../../src/webviews/jarvis-app/musicEngine.ts).

| Prompt score | Tier | Phrase |
|---|---|---|
| 80–96 | `triumphant` | Bright C-major fanfare, ascending arpeggio |
| 60–79 | `good` | Warm major chord with a gentle rise |
| 40–59 | `uneasy` | Slower A-minor phrase |
| 0–39 | `chaos` | Diminished cluster + chromatic stumble |

Preview each tier from the **Sounds** tab.

---

# Ambient Sound Files (optional)

The editor-diagnostics ambient loops below are independent of the score-reactive music
above and are optional. Place the following MP3 sound effect files in this directory:

| File | When it plays | Suggested vibe |
|---|---|---|
| `vibe-fire.mp3` | Score ≥ 80 — code is clean | Upbeat lo-fi, energetic |
| `vibe-chill.mp3` | Score 60–79 — minor warnings | Calm lo-fi, steady beat |
| `vibe-worried.mp3` | Score 40–59 — moderate issues | Slightly tense ambient |
| `vibe-chaos.mp3` | Score 0–39 — lots of errors | Glitchy, chaotic, dramatic |
| `vibe-idle.mp3` | No file open | Quiet ambient |
| `vibe-compile.mp3` | On every file save | Short satisfying blip/chime |

## Free Sound Sources

- https://freesound.org (Creative Commons)
- https://pixabay.com/music/
- https://www.looperman.com

## Tips

- Keep files short (10–30 seconds) — they loop or replay on state changes
- Use `.mp3` format for cross-platform compatibility
- Keep file sizes small (< 1MB each) for fast extension loading

