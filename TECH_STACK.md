# Genouk — Tech Stack

A map of every technology in genouk: **what it is, what it does, and where it lives** in the codebase.

Genouk is a **VS Code extension** that helps you work with AI — reviewing/rewriting prompts, reviewing diffs, planning sessions, giving codebase tours, syncing tasks to Linear, and carrying memory across chats. It's built from three pieces that run in different places, which is the key to understanding the stack.

---

## The big picture: three runtimes, one repo

All the source lives in `src/`, but it compiles into **three separate programs** that run in three different environments. This is why the stack is split the way it is.

| Runtime | What it is | Built from | Output file |
|---|---|---|---|
| **Extension host** | The extension logic — runs inside VS Code (Node.js) | `src/*.ts`, `src/sidebar/*` | `dist/extension.js` |
| **Webview app** | The UI you see — runs in a browser-like sandbox | `src/webviews/genouk-app/*` | `dist/genoukApp.js` |
| **MCP server** | Standalone memory server — its own Node process | `src/memory/mcpServer.ts` | `dist/mcpServer.js` |

The golden rule: **extension-host code can use the VS Code API but not browser APIs; webview code is the reverse; the memory store must stay free of `vscode` imports** so both the host and the MCP server can share it.

---

## Languages

### TypeScript
The entire codebase. Gives us type safety across the message-passing boundary between the extension host and the webview (the two sides talk via `postMessage`, so shared types in `src/shared/types.ts` keep them in sync).

### JavaScript / JSX
The compiled output, and the React UI is written in `.tsx` (TypeScript + JSX).

---

## Platforms

### VS Code Extension API
**What it is:** the host platform — genouk *is* a VS Code extension.
**Where it's used:**
- `src/extension.ts` — the entry point (`activate()`). Registers the sidebar, commands, and keybindings.
- `src/GenoukSidebarProvider.ts` — hosts the sidebar webview and routes messages between UI and backend.
- `src/PlannerPanel.ts` — the pop-out planner window (a separate webview panel).
- `src/SessionStore.ts` — persistence via VS Code `workspaceState`.
- `src/secrets.ts` — credentials stored in encrypted **SecretStorage** (OS keychain), not plaintext settings.
- `package.json` `contributes` block — declares commands (`genouk.openPlanner`, `genouk.syncTodosToLinear`, tour navigation), keybindings (arrow keys during a tour), the sidebar view, and settings.

### Node.js
The runtime for the extension host and the MCP server. Both are bundled with `platform: 'node', target: 'node18'`.

---

## Front-end (the webview UI)

Everything under `src/webviews/genouk-app/` runs in the webview — a sandboxed browser environment inside VS Code.

### React 18
**What it does:** renders the entire UI.
**Where:** `src/webviews/genouk-app/index.tsx` is the entry point — a tabbed app (`PromptTab`, `SessionTab`, `TourTab`, `MemoryTab`, `PersonalizationTab`, planner views). Components like `TaskBoard.tsx`, `Mascot.tsx`, and `FocusTimerCard.tsx` are the building blocks.

### Framer Motion
**What it does:** animation.
**Where:** the mascot (`Mascot.tsx`) and UI transitions — the reactive character and smooth tab/card motion.

### Tone.js
**What it does:** the audio engine — generates the notification chime.
**Where:** `src/webviews/genouk-app/musicEngine.ts`. Plays a sound when another in-editor AI agent finishes writing code (the webview is kept alive when hidden via `retainContextWhenHidden` in `extension.ts` so the audio context stays unlocked).

### lucide-react
Icon set used throughout the UI.

---

## AI / Model layer

### Vultr Serverless Inference (cloud service)
**What it is:** the cloud GPU service that runs the LLM.
**Model:** `deepseek-ai/DeepSeek-V4-Flash`.
**Where:** `src/AIProvider.ts` is the single gateway for *every* model call — it holds the base URL (`https://api.vultrinference.com/v1`), resolves the API key from SecretStorage, and centralizes token/temperature/model settings. Nothing else calls the model directly.

**Who calls `AIProvider`:**
- `src/PromptReviewer.ts` — grades and rewrites prompts (two phases: a fast score, then a slower full rewrite).
- `src/ChangeReviewer.ts` — reviews `git diff HEAD` with severity-ranked findings.
- `src/SessionPlanner.ts` — turns a goal into a structured JSON task plan.
- `src/CodebaseTour.ts` — generates the guided architecture tour.

All of these share `src/RepoContext.ts`, which gathers repo grounding (languages, dependencies, file tree, recent commits, active-file snippet) so the model's answers reference *your* real code.

### Supporting libraries
- **Zod** — validates the shapes of model responses and message payloads.
- **jsonrepair** — repairs malformed JSON the model sometimes returns, so a slightly-broken response still parses (used in `PromptReviewer.ts` and other parsers).

---

## Integrations & APIs

### Model Context Protocol (MCP)
**What it is:** a standard protocol that lets external AI agents (Claude Code, Cursor) call tools.
**Library:** `@modelcontextprotocol/sdk`.
**Where:** `src/memory/mcpServer.ts` is a standalone server (bundled to `dist/mcpServer.js`) exposing memory tools (`save_context`, `recall_context`, `search_context`, etc.). The actual logic lives in `src/memory/sessionMemoryStore.ts` — deliberately **free of any `vscode` import** so both the MCP server and the extension host can use it.

**Cross-chat memory has two paths:**
1. **Write path (MCP):** an agent saves a session digest via the MCP server.
2. **Read path (text file):** the digest is rendered into a managed `<!-- GENOUK:MEMORY:START/END -->` block inside `CLAUDE.md`, which editors auto-load every session — so context carries over with **zero tool calls**.

### Linear API / Linear SDK
**What it does:** creates Linear issues.
**Library:** `@linear/sdk`.
**Where:**
- `src/LinearService.ts` — syncs session-plan tasks into Linear and backfills issue IDs/URLs.
- `src/TodoScanner.ts` — finds `TODO`/`FIXME` comments in the active file and turns them into issues (the `genouk.syncTodosToLinear` command).
- A separate standalone version exists in `linear-mcp-server/` (its own MCP server).

### Git
Not a library — genouk shells out to `git` to read `git diff HEAD` and recent commit history, feeding `ChangeReviewer` and `RepoContext`.

---

## Storage (no database)

Genouk has **no traditional database.** State lives in:
- **VS Code `workspaceState`** — session plans, tasks, settings (via `src/SessionStore.ts`), shared live between the sidebar and the pop-out planner through a change-event emitter.
- **`CLAUDE.md` managed block** — cross-chat memory, as plain text.
- **OS keychain (SecretStorage)** — API keys.

---

## Build & tooling

### esbuild (bundler)
**What it does:** compiles + bundles TypeScript/React source into runnable JavaScript. A "bundler" follows every `import`, converts TS/JSX to JS, and packs it into one optimized file per target.
**Where:** `esbuild.config.js` defines the three build targets:
- `extension.js` — `format: cjs, platform: node`, with `vscode` marked `external` (provided by the editor).
- `mcpServer.js` — `format: cjs, platform: node`, with a `#!/usr/bin/env node` banner so it's directly executable.
- `genoukApp.js` — `format: iife, platform: browser` for the webview.

Chosen over Webpack for speed — the `npm run dev` watch mode rebuilds in milliseconds.

### Other tooling
- **tsc** (`npm run compile`) — type-checking only (`--noEmit`); esbuild does the actual compiling.
- **@vscode/test-cli** + **@vscode/test-electron** — the extension test harness (`npm test`).
- **vsce** — packages the `.vsix` for distribution (`npm run package`).
- **dotenv** — loads local `.env` config.

---

## One-line summary

> **TypeScript** VS Code extension with a **React** webview, bundled by **esbuild** into three runtimes (extension host, webview, MCP server). AI runs on **Vultr Serverless Inference** (DeepSeek-V4-Flash) behind a single `AIProvider` gateway. Cross-chat memory uses the **Model Context Protocol** plus a managed `CLAUDE.md` block; tasks sync to **Linear**. **Tone.js** does audio, **Framer Motion** does animation. No database — state lives in VS Code `workspaceState` and text files.








