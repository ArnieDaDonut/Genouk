import * as vscode from 'vscode';
import Groq from 'groq-sdk';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { getSecret } from './secrets';
import { log } from './log';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

export interface GenerateOptions {
  /** Override the configured max_tokens for this call. */
  maxTokens?: number;
  /** Override the configured temperature for this call. */
  temperature?: number;
  /** Override the configured model for this call. */
  model?: string;
}

const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';
const DEFAULT_VULTR_MODEL = 'deepseek-ai/DeepSeek-V4-Flash';
const VULTR_BASE_URL = 'https://api.vultrinference.com/v1';
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.4;

/** One backend Genouk can call. Tried in order; the first that succeeds wins. */
interface Provider {
  name: string;
  generate(userContent: string, systemContent: string | undefined, opts: ResolvedOptions): Promise<string>;
}

interface ResolvedOptions {
  maxTokens: number;
  temperature: number;
  model?: string;
}

/**
 * Single entry point for all model calls. It keeps an ordered list of
 * providers and falls through to the next one whenever a call fails (rate
 * limits, outages, missing keys). Order: Vultr (if configured) → Groq →
 * Google Gemini. Callers are unchanged — they still call
 * `getInstance().generateContent(...)`.
 */
export class AIProvider {
  private static instance: AIProvider;

  private constructor() {}

  public static getInstance(): AIProvider {
    if (!AIProvider.instance) {
      AIProvider.instance = new AIProvider();
    }
    return AIProvider.instance;
  }

  /**
   * Providers to try, in order, given the keys currently configured. Keys are
   * resolved from SecretStorage (then legacy settings, then env) on each call so
   * a freshly-set key is picked up immediately with no restart.
   */
  private async providers(): Promise<Provider[]> {
    const config = vscode.workspace.getConfiguration('genouk');
    const list: Provider[] = [];

    const vultrKey = await getSecret('vultr');
    if (vultrKey) {
      const key = vultrKey;
      const vultrModel = config.get<string>('vultrModel') || process.env.VULTR_MODEL || DEFAULT_VULTR_MODEL;
      list.push({
        name: 'Vultr',
        generate: (userContent, systemContent, opts) =>
          callVultr(key, opts.model ?? vultrModel, userContent, systemContent, opts),
      });
    }

    const groqKey = await getSecret('groq');
    if (groqKey) {
      // maxRetries: the SDK retries 429/5xx with exponential backoff and honors
      // the Retry-After header — bumped from the default 2 so a brief rate-limit
      // spike self-heals before we fall through to Gemini.
      const groq = new Groq({ apiKey: groqKey, maxRetries: 4 });
      const groqModel = config.get<string>('model') || DEFAULT_MODEL;
      list.push({
        name: 'Groq',
        generate: async (userContent, systemContent, opts) => {
          const messages: { role: 'system' | 'user'; content: string }[] = [];
          if (systemContent) messages.push({ role: 'system', content: systemContent });
          messages.push({ role: 'user', content: userContent });
          const completion = await groq.chat.completions.create({
            model: opts.model ?? groqModel,
            messages,
            max_tokens: opts.maxTokens,
            temperature: opts.temperature,
          });
          return completion.choices[0]?.message?.content ?? '';
        },
      });
    }

    const geminiKey = await getSecret('gemini');
    if (geminiKey) {
      const key = geminiKey;
      const geminiModel = config.get<string>('geminiModel') || DEFAULT_GEMINI_MODEL;
      list.push({
        name: 'Gemini',
        generate: (userContent, systemContent, opts) =>
          callGemini(key, opts.model ?? geminiModel, userContent, systemContent, opts),
      });
    }

    return list;
  }

  /**
   * Generate a completion from a system/user message pair. Tries each configured
   * provider in order, falling through on failure. Throws only if every provider
   * fails (or none is configured).
   */
  public async generateContent(
    userContent: string,
    systemContent?: string,
    options: GenerateOptions = {},
  ): Promise<string> {
    const config = vscode.workspace.getConfiguration('genouk');
    const opts: ResolvedOptions = {
      maxTokens: options.maxTokens ?? config.get<number>('maxTokens') ?? DEFAULT_MAX_TOKENS,
      temperature: options.temperature ?? config.get<number>('temperature') ?? DEFAULT_TEMPERATURE,
      model: options.model,
    };

    const providers = await this.providers();
    if (providers.length === 0) {
      throw new Error(
        'No AI provider is configured. Run the "Genouk: Set API Key" command to add a Vultr, Groq, or Gemini key.',
      );
    }

    // Collect every provider's failure so the surfaced error explains the whole
    // fallback chain, not just the last hop (e.g. "Groq failed AND Gemini failed").
    const failures: string[] = [];
    for (const provider of providers) {
      try {
        const text = await provider.generate(userContent, systemContent, opts);
        if (text.trim()) {
          log(`AI provider used: ${provider.name}`);
          return text;
        }
        failures.push(`${provider.name}: empty response`);
        log(`${provider.name} returned an empty response.`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failures.push(`${provider.name}: ${shorten(msg)}`);
        // The banner shows a trimmed line; the output channel keeps the full text.
        log(`${provider.name} FAILED (full error):\n${msg}`);
        console.warn(`[Genouk] ${provider.name} failed, trying next provider:`, err);
      }
    }

    throw new Error(`All AI providers failed.\n${failures.map((f) => `• ${f}`).join('\n')}`);
  }
}

/** Trim a long provider error to its first meaningful line for the UI. */
function shorten(msg: string): string {
  // Pull the human-readable "message" out of a JSON error body if present.
  const m = /"message"\s*:\s*"([^"]+)"/.exec(msg);
  const text = m ? m[1] : msg;
  return text.length > 200 ? text.slice(0, 200) + '…' : text;
}

/**
 * Call Vultr Serverless Inference. Its chat API is OpenAI-compatible, so a plain
 * fetch is all we need — no SDK. Endpoint and auth per Vultr's inference docs.
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
      Authorization: `Bearer ${apiKey}`,
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

  // Some Vultr-hosted models are reasoning models: when the final answer is
  // short they may leave `content` null and put text under `reasoning`. Fall
  // back to it so we never return an empty string from a successful call.
  const data = (await res.json()) as {
    choices?: { message?: { content?: string | null; reasoning?: string | null } }[];
  };
  const msg = data.choices?.[0]?.message;
  return msg?.content ?? msg?.reasoning ?? '';
}

/**
 * Call the Gemini REST API directly via fetch. We deliberately avoid the
 * `@google/genai` SDK: it pulls in Google's auth stack, websockets, and stream
 * polyfills (~1.5MB bundled) for what is a single JSON POST. Node 18+ (our
 * target) ships a global `fetch`.
 */
async function callGemini(
  apiKey: string,
  model: string,
  userContent: string,
  systemContent: string | undefined,
  opts: ResolvedOptions,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: userContent }] }],
    generationConfig: { maxOutputTokens: opts.maxTokens, temperature: opts.temperature },
  };
  if (systemContent) {
    body.system_instruction = { parts: [{ text: systemContent }] };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
}
