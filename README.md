# Genouk

> Your AI pair-companion for prompt engineering, code review, and staying in flow — with a living mascot in your sidebar.

Genouk is a VS Code extension that reviews your prompts and code changes, plans your work sessions, narrates a live tour of your codebase, syncs TODOs to Linear, and keeps you company with an animated character that reacts to what you're doing.

---

## Features

### 🤖 Genouk, your mascot
An animated sprite lives in the sidebar and reacts to your work in real time — cheering on a clean review, looking alarmed at a blocker, dozing off when you go idle, and even strolling across the panel. It can also act as a "courier," walking over to press review buttons for you.

### ✍️ Prompt review
Get an instant quality score and concrete suggestions on any prompt before you send it to a model. Genouk reacts to the score so you get a feel at a glance.

### 🔍 Change review
Reviews your current diff and flags issues as **BLOCKER / WARNING / NIT**, with an INTENT summary so you know what the change is trying to do.

### 🗂️ Session planner
Break work into tasks, track progress, and get nudged toward the finish line. Genouk celebrates milestones (halfway, done) as you complete tasks.

### 🧭 Live codebase tour
A guided, narrated walkthrough of your code. Step forward and back with the arrow keys while Genouk points things out.

### 🔗 Linear integration
Scan the active file for `TODO` / `FIXME` comments and turn them into Linear issues in one command — the issue key is written back into your code so nothing gets synced twice.

### 🔊 Audio & personalization
Vibe-based ambient sounds and event SFX (compile success/error), plus accessories you can put on your mascot.

---

## Getting started

1. Install Genouk and open the **Genouk** icon in the Activity Bar.
2. Add an API key (see below). Genouk works with **Vultr**, **Groq**, or **Google Gemini** — and falls back automatically between whichever you've configured.
3. Start reviewing prompts and changes from the sidebar.

### Configuring an AI provider

Genouk tries providers in order — **Vultr → Groq → Gemini** — and uses the first one that succeeds, so a single key is enough to get going. Open **Settings → Extensions → Genouk** and add any of:

| Provider | Setting | Get a key |
| --- | --- | --- |
| Vultr (primary) | `genouk.vultrApiKey` | [Vultr Serverless Inference](https://www.vultr.com/products/serverless-inference/) |
| Groq | `genouk.groqApiKey` | [console.groq.com/keys](https://console.groq.com/keys) |
| Gemini (free fallback) | `genouk.geminiApiKey` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |

---

## Commands

| Command | Description |
| --- | --- |
| `Genouk: Open Planner Window` | Open the session planner in its own panel. |
| `Genouk: Sync TODOs in Active File to Linear` | Turn TODO/FIXME comments into Linear issues. |
| `Genouk: Live Tour Next Stop` | Advance the codebase tour (also bound to `→`). |
| `Genouk: Live Tour Previous Stop` | Go back a stop (also bound to `←`). |

---

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `genouk.vultrApiKey` | `""` | Vultr Serverless Inference API key (primary provider). |
| `genouk.vultrModel` | `llama-2-70b-chat-Q5_K_M` | Vultr inference model ID. |
| `genouk.groqApiKey` | `""` | Groq API key. |
| `genouk.model` | `llama-3.3-70b-versatile` | Groq model for prompt and change review. |
| `genouk.geminiApiKey` | `""` | Gemini API key (free fallback). |
| `genouk.geminiModel` | `gemini-2.0-flash` | Gemini fallback model. |
| `genouk.maxTokens` | `4096` | Max tokens per review response. |
| `genouk.temperature` | `0.4` | Sampling temperature (lower = more focused). |
| `genouk.linearApiKey` | `""` | Linear Personal API key for TODO sync. |
| `genouk.linearTeamId` | `""` | Linear Team ID or key (e.g. `ENG`). |

---

## Linear setup

To use TODO syncing:
1. Generate a Personal API key at [linear.app/settings/api](https://linear.app/settings/api) and set `genouk.linearApiKey`.
2. Set `genouk.linearTeamId` to your team's ID or key (e.g. `ENG`).
3. Open a file with `TODO:` / `FIXME:` comments and run **Genouk: Sync TODOs in Active File to Linear**.

---

## Contributing

Issues and PRs welcome at [github.com/ArnieDaDonut/Genouk](https://github.com/ArnieDaDonut/Genouk).

```bash
npm install
npm run dev        # esbuild watch
# Press F5 in VS Code to launch the Extension Development Host
```

## License

[MIT](LICENSE) © Genouk
