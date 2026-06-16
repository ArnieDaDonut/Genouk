# AGENTS.md

This file provides guidance to agents working with code in this repository.

## Cross-chat memory — do this every session

This project runs a `genouk-memory` MCP server (configured in `.mcp.json`) that carries
context across separate chats. **If that server's tools are available to you, use them:**

1. **At the start of a session**, before doing other work, call **`recall_context`** to
   load what previous chats accomplished — decisions made, files touched, and open
   threads. Continue from there instead of starting cold.
2. **At the end of a session**, or after finishing a meaningful chunk of work, call
   **`save_context`** with a concise digest:
   - `title`: one line, e.g. "Built the cross-chat memory MCP server".
   - `summary`: a few sentences — what changed and why.
   - `decisions`: concrete decisions made (bullets).
   - `files`: files created or meaningfully changed.
   - `openThreads`: unresolved threads / next steps for the following session.
   - `resolvedThreads`: open threads from EARLIER sessions you finished this time — copy
     their text from `recall_context`'s "Still open" list so they stop resurfacing.
3. Use **`update_context`** to amend the current session's digest in place (append
   decisions/files/threads, or resolve threads) instead of saving a near-duplicate digest.
4. Use **`search_context`** to look up a past topic, file, or decision when relevant.

`recall_context` leads with a consolidated "⏳ Still open across past sessions" list — treat
that as your starting checklist for the chat. Write the digest the way you'd brief a teammate
taking over. The `.mcp.json` is now written automatically when the Genouk extension activates;
if the tools still aren't available, connect the server from Genouk's **Memory** tab.

## Project shape
- This repository contains two related Node/TypeScript codebases:
  - Root project: a VS Code extension (`genouk`) with extension-host logic in `src/*.ts` and a React webview app in `src/webviews/genouk-app/*`.
  - `linear-mcp-server/`: a standalone MCP server (`index.js`) that scans TODO/FIXME comments and creates Linear issues.
- `README.md` is currently empty, so operational details should be taken from source and package scripts.

## Common commands
Run these from the repository root unless noted.

### Root extension (`genouk`)
- Install deps:
  - `npm install`
- Dev watch build (extension + webview bundles via esbuild):
  - `npm run dev`
- Production bundle (used for packaging/publish flow):
  - `npm run bundle`
- Type-check:
  - `npm run compile`
- VS Code extension test entrypoint:
  - `npm test`
- Package extension VSIX:
  - `npm run package`

### `linear-mcp-server` subproject
Run these from `linear-mcp-server/`.

- Install deps:
  - `npm install`
- Start MCP server over stdio:
  - `node index.js`
- Run local regex/file-write test harness:
  - `node test.js`
- Run live Linear connectivity test (requires `.env` with `LINEAR_API_KEY` and `LINEAR_API_TEAM_ID`):
  - `node test-live.js`

### Notes on linting and single-test execution
- There is no dedicated lint script/config in this repo today (no `npm run lint` at root). Use `npm run compile` as the current static validation baseline.
- There is no explicit single-test command wired in scripts yet; tests are currently invoked through the aggregate `npm test` entrypoint.

## High-level architecture
### 1) Extension host entrypoint and command wiring
- `src/extension.ts` activates on startup, creates the shared `SessionStore`, and registers:
  - Sidebar webview provider (`genouk.sidebar`) via `GenoukSidebarProvider`.
  - Popout planner command (`genouk.openPlanner`) via `PlannerPanel`.
  - Live tour navigation commands (`genouk.tourNext`, `genouk.tourPrevious`) gated by `genouk.liveTour` context key.
  - TODO→Linear sync command (`genouk.syncTodosToLinear`) that scans active document comments and rewrites synced lines with `[ISSUE-KEY]`.

### 2) Two webview surfaces sharing one state store
- Sidebar UI is hosted by `GenoukSidebarProvider` and rendered from `dist/genoukApp.js`.
- Popout planner window is hosted by `PlannerPanel`, reusing the same webview bundle but switching rendering mode with `window.GENOUK_VIEW = 'planner'` in `plannerHtml`.
- Both surfaces synchronize through `SessionStore` (`workspaceState` + change event emitter), so plan edits in one view propagate to the other.

### 3) Message-driven UI/backend contract
- `GenoukSidebarProvider` is the backend message router for most sidebar actions (`reviewPrompt`, `reviewChanges`, `generateSessionPlan`, `generateTour`, `syncToLinear`, file reveal/open actions).
- Frontend entrypoint `src/webviews/genouk-app/index.tsx` is a tabbed React app (`PromptTab`, `SessionTab`, `TourTab`, `ChangesTab`, `MemoryTab`, `AudioTab`) that exchanges structured `postMessage` events with the extension host.
- Live tour flow spans both sides:
  - UI requests/generates tour data.
  - Backend resolves files/symbols and highlights lines via decorations.
  - Keyboard command and webview events coordinate stop navigation.

### 4) AI service layer and feature modules
- `AIProvider` is the single model gateway. It resolves configured providers in order (Groq first, Gemini fallback) and centralizes token/model/temperature settings.
- Feature modules call `AIProvider`:
  - `PromptReviewer`: prompt critique + rewrite, enriched with repository context.
  - `ChangeReviewer`: reviews `git diff HEAD` output with severity-ranked findings.
  - `SessionPlanner`: generates structured JSON task plans.
  - `CodebaseTourGenerator`: synthesizes architecture/stops from ranked source files and repo context.
- `RepoContext` is shared context plumbing: package summary, shallow tree/language stats, recent commits, and optional active-file snippet for prompt review.

### 5) Linear integration paths
- In-extension Linear integration (`LinearService`):
  - Syncs session-plan tasks into Linear and backfills `linearIssueId`/`linearIssueUrl`.
  - Creates issues from TODO/FIXME comments for active-file command flow.
- External MCP path (`linear-mcp-server/index.js`):
  - Exposes `sync_todos_to_linear` tool via MCP stdio transport.
  - Performs similar TODO regex detection and in-file issue-key rewrite, but as a standalone server process.

## Build/bundle outputs and runtime boundaries
- Build pipeline (`esbuild.config.js`) emits three bundles into `dist/`:
  - `dist/extension.js` (Node/CJS, VS Code extension host runtime).
  - `dist/mcpServer.js` (Node/CJS, standalone `genouk-memory` MCP server process; see `src/memory/`).
  - `dist/genoukApp.js` (browser IIFE, loaded by webviews).
- Keep extension-host code (`src/*.ts`) VS Code API-safe and Node-targeted; keep webview code (`src/webviews/genouk-app/*`) browser/React-safe. Keep `src/memory/sessionMemoryStore.ts` free of any `vscode` import — it is shared by the extension host and the standalone MCP server.

<!-- GENOUK:MEMORY:START -->
## ⏳ Cross-chat memory — carried over from past chats

_Genouk keeps this section in sync from past Genouk chat digests — don't edit it by hand._

**Last session:** Reframed Memory tab around the CLAUDE.md text-file carry-over (6/14/2026, 6:20:45 AM)

**✅ No open threads carried over** — past sessions closed cleanly.

### Recent sessions (3)

#### Reframed Memory tab around the CLAUDE.md text-file carry-over
_6/14/2026, 6:20:45 AM_

Updated Genouk's Memory tab to reflect that cross-chat recall now rides on the auto-loaded CLAUDE.md block rather than the MCP server. Added memoryFilePath + memoryFileWritten to MemoryData/getMemoryData (getMemoryData now refreshes the block on load so the 'CLAUDE.md synced' badge is truthful). Rewrote MemoryTab.tsx: intro now leads with automatic carry-over, a new Carry-over card shows a green 'CLAUDE.md synced' status, the .mcp.json setup is demoted to a collapsible 'Saving new sessions (optional)' section, and remembered facts are now surfaced read-only (good for the secret-word demo). Kept the tab (decided it's a strong demo surface) rather than removing it. Typecheck + bundle pass.

**Decisions:**
- Keep the Memory tab but reframe it around CLAUDE.md carry-over instead of MCP plumbing
- getMemoryData refreshes the CLAUDE.md block on load so the synced badge always reflects reality (no-op write when unchanged)
- Demote .mcp.json setup to a collapsed 'optional saving' section since recall no longer needs it
- Surface remembered facts in the tab read-only

**Files touched:**
- src/shared/types.ts
- src/sidebar/MemoryService.ts
- src/webviews/genouk-app/MemoryTab.tsx

#### Added text-file (CLAUDE.md) path for cross-chat carry-over
_6/14/2026, 5:59:26 AM_

The MCP-only carry-over was unreliable because it depended on the agent choosing to call recall_context at chat start. Added a text-file path: a new renderCarryover() + syncCarryoverFile() in the vscode-free sessionMemoryStore writes the facts/open-threads/recent-digests briefing into a managed <!-- GENOUK:MEMORY:START/END --> block in the repo's CLAUDE.md, which Claude Code/Cursor auto-load every session with zero tool calls. MCP server now refreshes the block on save_context/update_context/remember/forget; MemoryService.syncMemoryFile() refreshes it on activation (ensureConfig) and on tab mutations. MCP kept for the write/save side only. Verified renderer output against the real stored digest, confirmed the block writes idempotently into CLAUDE.md, typecheck + bundle pass.

**Decisions:**
- Keep the genouk-memory MCP server for SAVING digests; replace the RECALL path with an auto-loaded CLAUDE.md managed block
- Block fenced by <!-- GENOUK:MEMORY:START/END --> markers, rewritten in place so the rest of CLAUDE.md is preserved
- Block-writing logic lives in vscode-free sessionMemoryStore.ts so both the extension host and the standalone MCP server can keep CLAUDE.md current
- MCP server refreshes CLAUDE.md the instant a session is saved, so carry-over is current without waiting for the extension to reactivate

**Files touched:**
- src/memory/sessionMemoryStore.ts
- src/memory/mcpServer.ts
- src/sidebar/MemoryService.ts
- CLAUDE.md

#### DEMO: tried out cross-chat memory
_6/13/2026, 5:52:06 PM_

Built and tested the genouk-memory MCP server. Verified save/recall carries context between separate chats.

**Decisions:**
- Memory is keyed per-repo via GENOUK_REPO
- Agent writes the digest itself (no extra API key)

**Files touched:**
- src/memory/mcpServer.ts
- src/memory/sessionMemoryStore.ts

**Open threads:**
- Wire the same rule into CLAUDE.md
- Try it from a real agent (Cursor/Claude Code)

> When you finish a meaningful chunk of work, call `save_context` (genouk-memory MCP) so the next chat carries it forward.
<!-- GENOUK:MEMORY:END 