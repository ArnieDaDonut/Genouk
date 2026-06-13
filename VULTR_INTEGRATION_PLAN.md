# Plan: Add Vultr as the primary AI provider (hardcoded via `.env`, like Groq)

> Handoff doc for whoever implements this. Self-contained. Follow the steps in
> order; exact code to paste is in Step 3.

## Goal

Make **Vultr Serverless Inference** the primary AI provider, with its key loaded
from `.env` exactly like the current Groq key. Keep **Groq → Gemini** as automatic
fallbacks. No new architecture — Vultr is just another entry in the existing
provider chain.

## Why this is small

Every AI call in the app already funnels through one method:
`AIProvider.generateContent()` in [src/AIProvider.ts](src/AIProvider.ts). It builds
an ordered list of providers and tries each until one succeeds. Vultr's API is
**OpenAI-compatible** (`POST /chat/completions`), so adding it is the same `fetch`
pattern already used for Gemini (`callGemini` at the bottom of that file). Nothing
else in the codebase needs to change.

---

## Step 0 — Confirm two things in the Vultr console

You cannot finish without these (the agent should ask the user if unknown):

1. **Inference base URL.** Expected: `https://api.vultrinference.com/v1`
   (so the chat endpoint is `https://api.vultrinference.com/v1/chat/completions`).
   Verify this is current.
2. **A model ID** that's enabled on the account (e.g. a Llama variant). This becomes
   `DEFAULT_VULTR_MODEL`.
3. An **API key** from the console (Inference → API Keys).

## Step 1 — Put the key in `.env`

Add to the project-root `.env` (already git-ignored, already loaded by `dotenv`):

```
VULTR_API_KEY=<paste the key>
```

> `.env` is read **once at extension activation**, so after editing it you must
> reload the Extension Development Host window for the new key to load.

## Step 2 — Read the current provider code

Open [src/AIProvider.ts](src/AIProvider.ts) and note these landmarks you'll edit:
- The `const DEFAULT_MODEL`, `DEFAULT_GEMINI_MODEL`, … block near the top.
- `private groq?` / `private geminiKey?` fields on the class.
- `private initialize()` — where keys are read.
- `private providers()` — where the ordered list is built (Groq pushed first, then
  Gemini).
- `callGemini(...)` helper at the bottom — copy its shape for Vultr.

## Step 3 — Edit `src/AIProvider.ts` (exact changes)

**3a. Add constants** next to the other `DEFAULT_*` constants: 

```ts
const DEFAULT_VULTR_MODEL = 'llama-2-70b-chat-Q5_K_M'; // <-- replace with a real model ID from the Vultr console
const VULTR_BASE_URL = 'https://api.vultrinference.com/v1'; // <-- verify in console
```

**3b. Add a field** next to `private groq?` / `private geminiKey?`:

```ts
  private vultrKey?: string;
```

**3c. In `initialize()`**, add (mirrors the Groq/Gemini key reads):

```ts
    this.vultrKey = config.get<string>('vultrApiKey') || process.env.VULTR_API_KEY || undefined;
```

**3d. In `providers()`**, push Vultr **first** so it's primary. Add this block at
the very start of the list-building (before the `if (this.groq)` block):

```ts
    if (this.vultrKey) {
      const key = this.vultrKey;
      const vultrModel = config.get<string>('vultrModel') || DEFAULT_VULTR_MODEL;
      list.push({
        name: 'Vultr',
        generate: (userContent, systemContent, opts) => callVultr(key, vultrModel, userContent, systemContent, opts),
      });
    }
```

**3e. Add the `callVultr` helper** at the bottom of the file, next to `callGemini`:

```ts
/**
 * Call Vultr Serverless Inference (OpenAI-compatible chat completions). No SDK —
 * a single JSON POST keeps the bundle lean, same as the Gemini path.
 */
async function callVultr(
  apiKey: string,
  model: string,
  userContent: string,
  systemContent: string | undefined,
  opts: ResolvedOptions,
): Promise<string> {
  const messages: { role: 'system' | 'user'; content: string }[] = [];
  if (systemContent) messages.push({ role: 'system', content: systemContent });
  messages.push({ role: 'user', content: userContent });

  const res = await fetch(`${VULTR_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
    }),
  });

  if (!res.ok) {
    throw new Error(`Vultr ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? '';
}
```

## Step 4 — (Optional but recommended) add per-user settings

So users can also use their **own** Vultr key via Settings (not only `.env`). In
[package.json](package.json), under `contributes.configuration.properties`, mirror
the `genouk.groqApiKey` block:

```jsonc
"genouk.vultrApiKey": {
  "type": "string",
  "default": "",
  "description": "Your Vultr Serverless Inference API key (primary provider)."
},
"genouk.vultrModel": {
  "type": "string",
  "default": "llama-2-70b-chat-Q5_K_M",
  "description": "Vultr inference model ID (see your Vultr console)."
}
```

Also add `genouk.vultrApiKey` to the `onDidChangeConfiguration` check in the
`AIProvider` constructor so changing it in Settings re-initializes the client
(find the existing `e.affectsConfiguration('genouk.groqApiKey') || …` line and add
`|| e.affectsConfiguration('genouk.vultrApiKey')`).

## Step 5 — (Recommended) log which provider succeeded

To make it obvious Vultr is actually being used, in `generateContent()`'s success
path add a line before `return text;`:

```ts
        if (text.trim()) { log(`AI provider used: ${provider.name}`); return text; }
```

(The `log` import already exists in this file.) Output shows in **View → Output →
Genouk**.

## Step 6 — Build and test

```bash
npm run compile   # must pass (tsc --noEmit)
npm run bundle    # must succeed
# Reload the Extension Development Host window (so .env reloads)
```

**Test checklist:**
1. Open the **Prompts** tab, run a review. It should succeed.
2. Open **View → Output → Genouk** — confirm `AI provider used: Vultr`.
3. Temporarily put a bad `VULTR_API_KEY` and rerun → it should fall through to Groq,
   and the error banner should list `• Vultr: …` then succeed on Groq. This proves
   the fallback chain.

## Gotchas / notes

- **`.env` reload:** editing `.env` requires a window reload; Settings changes do
  not (that's why Step 4's `onDidChangeConfiguration` matters).
- **Verify URL + model** (Step 0). If `callVultr` 404s or returns "model not found",
  the base URL or model ID is wrong — fix the two constants in Step 3a.
- **Bundle size:** keep using `fetch`, not any Vultr/OpenAI SDK — the extension
  bundle already ballooned once from a heavyweight SDK (`@google/genai`) and was
  fixed by switching to `fetch`.
- **Provider order:** Vultr is pushed first = primary. To make it *only*, comment
  out the `if (this.groq)` and `if (this.geminiKey)` blocks instead of deleting them.
- **Cost:** Vultr inference is paid (no free tier like Groq). The hardcoded `.env`
  key means *you* pay for everyone using that build — fine for personal/testing,
  but for distribution rely on the per-user Settings key from Step 4 and remove the
  `.env` fallback.

## Definition of done

- A prompt review succeeds with `AI provider used: Vultr` in the output channel.
- Killing the Vultr key falls back to Groq cleanly.
- `npm run compile` and `npm run bundle` both pass.
</content>
