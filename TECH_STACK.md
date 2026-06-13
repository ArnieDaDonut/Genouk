# Genouk — Tech Stack & Architecture

Genouk is a **VS Code extension**: an AI coding companion with a pixel-art mascot
in the sidebar. Tabs: **Prompts** (review/rewrite a prompt), **Session** (goal →
tracked tasks + Pomodoro timer, pop-out window), **Tour** (AI walkthrough of your
codebase with live file highlighting), **Changes** (review the git diff), **You**
(mascot accessories + sound effects), **Sounds** (audio controls).

---

## The core idea: two worlds + a bridge

A VS Code extension runs in **two separate JavaScript environments**, and most of
the codebase structure follows from this:

```
  EXTENSION HOST (Node.js)        ⇄  postMessage ⇄        WEBVIEW (sandboxed browser)
  files · git · tasks · AI calls                          React UI · mascot · audio
  src/*.ts                                                src/webviews/jarvis-app/*
```

- **Host** can touch the filesystem, git, the editor, and the network — but can't
  draw UI.
- **Webview** renders the React UI and plays audio — but can't read files, reach
  the network, or call VS Code APIs (its CSP blocks all of that).
- They talk **only** by passing JSON messages. Every feature is: *UI asks the host
  to do something → host does it → host posts the result back.*

---

## The stack

**Shared:** TypeScript, bundled by **esbuild** into two outputs — `extension.js`
(Node/CommonJS) and `jarvisApp.js` (browser). `tsc` only type-checks `src/**/*.ts`,
so `.tsx` webview files are bundled but not type-checked (a known gap).

**Host side:** the **VS Code API** (`vscode`); **groq-sdk** for the primary AI
(Groq, model `llama-3.3-70b-versatile`); **Gemini via raw `fetch`** as the fallback
AI (no SDK — it's a single JSON POST); **dotenv** to load keys from `.env`.

**Webview side:** **React 18** (the UI); **framer-motion** (mascot + transitions);
**lucide-react** (icons); **Tone.js** (all sound is *synthesized live* — music and
SFX — since the CSP can't load audio files).

---

## Where things live

**Host (`src/`):**
- `extension.ts` — entry point; wires up the sidebar, store, and commands.
- `JarvisSidebarProvider.ts` — the hub: builds the webview, routes every UI
  message, and watches diagnostics/tasks/terminal to drive mood + sounds.
- `AIProvider.ts` — one entry for all AI calls; tries Groq, falls back to Gemini.
- `PromptReviewer.ts` · `ChangeReviewer.ts` · `CodebaseTour.ts` · `SessionPlanner.ts`
  — the four AI features.
- `SessionStore.ts` / `PlannerPanel.ts` — session-plan state + the pop-out window.
- `RepoContext.ts` — read-only project signal (tree, deps, commits) to ground the AI.
- `webviewHtml.ts` · `log.ts` — HTML helpers; the "Genouk" output channel.

**Webview (`src/webviews/jarvis-app/`):**
- `index.tsx` — root React app; owns state + the message bridge.
- `Mascot.tsx` — the character (animation, moods, speech, accessories).
- `*Tab.tsx` / `PlannerView.tsx` — one file per tab + the pop-out layout.
- `musicEngine.ts` — all synthesized music and sound effects.
- `theme.ts` · `ui.tsx` · `types.ts` · `taskUtils.ts` · `useFocusTimer.ts` ·
  `accessories.ts` · `quips.ts` — design tokens, UI primitives, helpers, data.

---

## Data & AI

- **Persistence:** session plan + last tour → *workspace* state; personalization →
  *global* state; API keys/models → VS Code **settings** (`jarvis.*`) or `.env`.
- **AI chain:** `AIProvider.generateContent()` tries **Groq** (free, fast, but has
  daily/per-minute token caps) then **Gemini** (only if a key is set). If all fail,
  the error lists each provider's reason; the full text goes to the Genouk output
  channel.

---

## Build & run

```bash
npm install      # dependencies
npm run compile  # type-check (tsc --noEmit)
npm run bundle   # build both bundles (esbuild)
npm run dev      # esbuild watch mode
# Press F5 to launch the Extension Development Host
```

Only `dist/extension.js` and `dist/jarvisApp.js` are loaded by the editor. The
bundle is kept lean by marking `vscode` external and avoiding heavy SDKs.
