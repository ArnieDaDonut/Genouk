# Genouk
Built By: Arnav M, Rohan T, Jeevithan M

A VS Code extension that helps you work alongside AI. Genouk reviews your prompts and code changes, plans your work sessions, gives narrated tours of your codebase, syncs TODOs to Linear, and carries memory across separate AI chats — all from a single sidebar with an animated companion that reacts to what you're doing.

---

## Overview

Genouk lives in the VS Code Activity Bar and organizes its tools into five tabs:

- **Prompts** — score and rewrite a prompt before you send it to a model.
- **Session** — break a goal into tasks, run a focus timer, and track progress.
- **Tour** — generate and play a guided, narrated walkthrough of your code.
- **Memory** — a shared, persistent memory that every AI chat in the project can read.
- **You** — personalize the mascot and choose your notification sounds.

All model calls run through a single provider gateway backed by [Vultr Serverless Inference](https://www.vultr.com/products/serverless-inference/). State is stored locally — there is no external database and no telemetry.

---

## Features

### Genouk, the companion

An animated character sits at the top of the sidebar and reacts to your work in real time: it celebrates a clean review, looks concerned at a blocker, dozes off when you go idle, and walks across the panel during a tour. It can also act as a courier, walking over to "press" a review button when you trigger one.

### Prompt review

Paste any prompt into the **Prompts** tab to get a quality score and concrete, actionable suggestions before you spend a model call on it. The review arrives in two phases — the score and critique land first, then a full rewritten version of your prompt fills in. The companion reacts to the score so you get a read at a glance.

### Change review

Genouk reviews your current working diff (`git diff HEAD`) and reports findings ranked by severity — **BLOCKER**, **WARNING**, or **NIT** — along with an INTENT summary describing what the change is trying to accomplish. Reviews are grounded in your actual repository context (languages, dependencies, file tree, recent commits), so feedback references your real code rather than generic advice.

### Session planner and focus timer

Turn a one-line goal into a structured task plan. From the **Session** tab you can:

- Generate a plan from a goal, then add, reorder, and check off tasks.
- Run a built-in **focus timer** (a Pomodoro-style focus/break cycle). Dedicate each focus block to a specific task; when the block ends, Genouk asks whether you finished it and offers to check it off.
- Extend an existing plan with a follow-up instruction ("add tests for the new endpoint").
- Export the plan to Markdown, or pop it out into its own window.
- Sync the plan's tasks to Linear (see below).

The companion celebrates milestones — reaching the halfway mark, finishing the last task — as you go.

### Live codebase tour

Generate a guided tour of your code from a short description of what you want to understand. Play it back as a narrated walkthrough: Genouk opens each file, reveals the relevant symbol, and explains what it does. Step forward and backward through stops with the **left/right arrow keys** while a tour is playing, or navigate manually.

### Cross-chat memory

This is the feature that lets separate AI chats share what they know about your project. Genouk keeps a live summary — decisions made, files touched, and open threads — in a managed block inside your repository's `CLAUDE.md`. Because agents such as Claude Code and Cursor load `CLAUDE.md` automatically at the start of every chat, a brand-new session already knows where the last one left off, with no copy-pasting and no tool calls.

Two paths make this work:

- **Recall (automatic):** the carry-over summary lives in `CLAUDE.md` and refreshes whenever a session is saved. Any agent reads it on its own.
- **Saving (optional):** a bundled [Model Context Protocol](https://modelcontextprotocol.io) server lets agents *write* new session digests and durable facts. Recall works without it; you only wire it up if you want agents to record new memory.

The **Memory** tab shows everything remembered for the project — session digests (expandable into their decisions, files, and open threads) and pinned facts — along with carry-over status, and gives you one-click buttons to write or copy the MCP configuration.

#### Memory tools (for connected agents)

Once the MCP server is wired into your agent, it exposes these tools:

| Tool | What it does |
| --- | --- |
| `recall_context` | Pull the most recent session digests. Call at the start of a chat. |
| `save_context` | Persist a digest (summary, decisions, files, open threads) at the end of a chat. |
| `update_context` | Update the most recent digest in place. |
| `search_context` | Keyword-search past sessions. |
| `remember` | Store a single durable fact that surfaces in every future chat. |
| `forget` | Remove a remembered fact by id. |
| `list_facts` | List every remembered fact with ids. |

### Linear integration

Scan the active file for `TODO` and `FIXME` comments and turn them into Linear issues with a single command. The created issue key is written back into your code so the same comment never gets synced twice. Session-plan tasks can also be pushed to Linear, with issue IDs and URLs backfilled onto the tasks.

### Audio and personalization

Genouk uses synthesized audio for ambient sound tied to your current "vibe" and for event cues — successful compile, compile error, and notifications. In the **You** tab you can:

- Choose an accessory for the companion.
- Pick the sound used for each event from a menu, and preview each one.

Genouk can also play a notification sound when **another in-editor AI agent finishes writing code** — detected when a burst of large, multi-line edits settles. This is on by default and can be toggled in settings.

---

## Getting started

1. Install Genouk and open the **Genouk** icon in the Activity Bar.
2. Run the **Genouk: Set API Key** command from the Command Palette to add a Vultr key. This stores the key in the OS keychain rather than in plaintext settings.
3. Open the **Prompts** or **Session** tab and start working.

### Configuring the AI provider

Genouk runs on Vultr Serverless Inference. The recommended way to add your key is the **Genouk: Set API Key** command, which stores it securely in your operating system's keychain. Get a key from the [Vultr Inference dashboard](https://my.vultr.com/inference/).

By default Genouk picks a current chat model automatically and falls back to another available model if the configured one has been rotated out of Vultr's catalogue. To pin a specific model, set `genouk.vultrModel`.

---

## Commands

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and search for "Genouk":

| Command | Description |
| --- | --- |
| `Genouk: Set API Key` | Store your Vultr (or Linear) key securely in the OS keychain. |
| `Genouk: Open Planner Window` | Open the session planner in its own panel. |
| `Genouk: Sync TODOs in Active File to Linear` | Turn TODO/FIXME comments into Linear issues. |
| `Genouk: Live Tour Next Stop` | Advance the codebase tour (also bound to the right arrow key). |
| `Genouk: Live Tour Previous Stop` | Go back a stop (also bound to the left arrow key). |
| `Genouk: Test Agent-Done Notification Sound` | Preview the agent-finished notification sound. |

---

## Settings

Open **Settings → Extensions → Genouk** to adjust:

| Setting | Default | Description |
| --- | --- | --- |
| `genouk.vultrApiKey` | `""` | Fallback Vultr key. Prefer the **Set API Key** command, which stores the key in the OS keychain. |
| `genouk.vultrModel` | `""` | Pin a specific Vultr model id (for example `nvidia/DeepSeek-V3.2-NVFP4`). Leave blank to auto-select. |
| `genouk.maxTokens` | `4096` | Maximum tokens per review response. |
| `genouk.temperature` | `0.4` | Sampling temperature for reviews (lower is more focused). |
| `genouk.linearApiKey` | `""` | Fallback Linear Personal API key. Prefer the **Set API Key** command. |
| `genouk.linearTeamId` | `""` | Your Linear Team ID or key (for example `ENG`). |
| `genouk.agentDoneSound` | `true` | Play a sound when another in-editor AI agent finishes writing code. |

---

## Linear setup

To sync TODOs and tasks to Linear:

1. Generate a Personal API key at [linear.app/settings/api](https://linear.app/settings/api) and add it via the **Genouk: Set API Key** command (or `genouk.linearApiKey`).
2. Set `genouk.linearTeamId` to your team's ID or key (for example `ENG`).
3. Open a file containing `TODO:` or `FIXME:` comments and run **Genouk: Sync TODOs in Active File to Linear**.

---

## Development

Genouk is written in TypeScript with a React webview UI, bundled by esbuild into three targets: the extension host, the webview app, and the standalone MCP memory server.

```bash
npm install
npm run dev        # esbuild watch
# Press F5 in VS Code to launch the Extension Development Host
```

Other scripts:

- `npm run compile` — type-check only (`tsc --noEmit`).
- `npm test` — run the extension test suite.
- `npm run package` — build a distributable `.vsix`.

See [TECH_STACK.md](TECH_STACK.md) for a full map of the architecture.

---

## Contributing

Issues and pull requests are welcome at [github.com/ArnieDaDonut/Genouk](https://github.com/ArnieDaDonut/Genouk).

## License

[MIT](LICENSE) © Genouk
