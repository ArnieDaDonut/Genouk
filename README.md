# Detonate 🔥

> **JamHacks — Best Developer Tool**

A VS Code extension that brings three superpowers to your workflow:

---

## Features

### 🔥 Blast Radius
Select any symbol (function, class, variable) and instantly see everything that would break if you changed it — the dependency ripple, lit up live in your editor.

**How to use:**
- Place cursor on any symbol → press `Cmd+Shift+D` (Mac) / `Ctrl+Shift+D` (Windows/Linux)
- Or right-click → *Detonate: Show Blast Radius*
- View the impact tree in the **Blast Radius** sidebar panel

**What you see:**
- 🔴 Direct callers (depth 1) — highlighted in red
- 🟠 Indirect callers (depth 2) — highlighted in orange  
- 🟡 Deep ripple (depth 3+) — highlighted in yellow
- Overview ruler markers so you can scan at a glance

### 🧠 Code Teacher
Hover over any symbol to get a one-line AI summary. Press `Cmd+Shift+E` to open a full explanation panel with a detailed breakdown powered by Gemini.

**How to use:**
- Hover over any symbol for a quick tooltip
- Select code → press `Cmd+Shift+E` for the full panel
- The panel streams the explanation in real time

**Setup:** Add your Gemini API key in Settings → `detonate.geminiApiKey`  
Get a free key at [aistudio.google.com](https://aistudio.google.com/app/apikey)

### 🎵 Vibe Score
Sound effects and a status bar score that match how well your code is doing — based on real-time diagnostics.

| Score | State | Sound |
|---|---|---|
| 80–100 | 🔥 On Fire | Upbeat lo-fi |
| 60–79  | 😎 Chill    | Calm beats  |
| 40–59  | 😬 Worried  | Tense ambient |
| 0–39   | 💀 Chaos    | Glitchy/chaotic |

- Toggle sound: `Cmd+Shift+D` → click status bar item
- Connect Spotify: *Detonate: Connect Spotify* (adjusts volume based on your score)

---

## Setup

```bash
# Install dependencies
npm install

# Development (opens Extension Development Host on F5)
npm run dev

# Build for packaging
npm run bundle
npx vsce package
```

## Settings

| Setting | Default | Description |
|---|---|---|
| `detonate.geminiApiKey` | `""` | Gemini API key for Code Teacher |
| `detonate.vibeSound` | `true` | Enable sound effects |
| `detonate.vibeVolume` | `50` | Sound volume 0–100 |
| `detonate.blastRadiusMaxDepth` | `3` | Max call depth to traverse |
| `detonate.autoBlastRadius` | `false` | Auto-trigger on cursor rest |
| `detonate.spotifyClientId` | `""` | Spotify Client ID for integration |

## Keybindings

| Shortcut | Action |
|---|---|
| `Cmd+Shift+D` | Show Blast Radius |
| `Cmd+Shift+E` | Explain selected code |

---

Built with ❤️ for JamHacks
