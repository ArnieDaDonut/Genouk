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
3. Use **`search_context`** to look up a past topic, file, or decision when relevant.

Write the digest the way you'd brief a teammate taking over. If the tools are not
available, the user can connect the server from Genouk's **Memory** tab.

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
