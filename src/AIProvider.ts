import * as vscode from 'vscode';
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
  /** When true, sends `response_format: { type: 'json_object' }` to force valid JSON output. */
  jsonMode?: boolean;
}

const DEFAULT_VULTR_MODEL = 'MiniMaxAI/MiniMax-M2.7';
const VULTR_BASE_URL = 'https://api.vultrinference.com/v1';
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.4;

// When the configured model is gone (Vultr rotates its catalogue), fall back to
// the first of these that the live /models list still serves.
// Ordered by empirical JSON compliance: MiniMax properly separates content from
// reasoning; the others put everything in the reasoning field.
const VULTR_FALLBACK_PRIORITY = [
  'MiniMaxAI/MiniMax-M2.7',
  'deepseek-ai/DeepSeek-V4-Flash',
  'moonshotai/Kimi-K2.6',
  'Qwen/Qwen3.5-397B-A17B',
  'zai-org/GLM-5.1-FP8',
  'nvidia/DeepSeek-V3.2-NVFP4',
];

/** One backend Genouk can call. Tried in order; the first that succeeds wins. */
interface Provider {
  name: string;
  generate(userContent: string, systemContent: string | undefined, opts: ResolvedOptions): Promise<string>;
}

interface ResolvedOptions {
  maxTokens: number;
  temperature: number;
  model?: string;
  jsonMode: boolean;
}

/**
 * Single entry point for all model calls. Genouk runs on Vultr Serverless
 * Inference. Callers go through `getInstance().generateContent(...)`.
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
   * The configured provider (Vultr), or an empty list if no key is set. The key is
   * resolved from SecretStorage (then legacy settings, then env) on each call so a
   * freshly-set key is picked up immediately with no restart.
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
          generateVultr(key, opts.model ?? vultrModel, userContent, systemContent, opts),
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
      jsonMode: options.jsonMode ?? false,
    };

    const providers = await this.providers();
    if (providers.length === 0) {
      throw new Error(
        'No AI provider is configured. Run the "Genouk: Set API Key" command to add a Vultr key.',
      );
    }

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

// Cached /models list (Vultr's catalogue changes rarely; refresh every 5 min).
let modelListCache: { ids: string[]; at: number } | null = null;
// Remembers a working substitute once a configured model turns out to be gone,
// so subsequent calls skip the failed attempt entirely.
const resolvedModels = new Map<string, string>();

/** Fetch the ids Vultr currently serves, cached. Returns [] (last good) on failure. */
async function listVultrModels(apiKey: string): Promise<string[]> {
  const now = Date.now();
  if (modelListCache && now - modelListCache.at < 5 * 60 * 1000) return modelListCache.ids;
  try {
    const res = await fetch(`${VULTR_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return modelListCache?.ids ?? [];
    const data = (await res.json()) as { data?: { id?: string; object?: string }[] };
    const ids = (data.data ?? [])
      .filter((m) => m.object === 'model' && typeof m.id === 'string')
      .map((m) => m.id as string);
    modelListCache = { ids, at: now };
    return ids;
  } catch {
    return modelListCache?.ids ?? [];
  }
}

/** Pick a valid chat model from the live list, preferring our priority order. */
async function pickValidModel(apiKey: string, exclude: string): Promise<string | null> {
  const ids = await listVultrModels(apiKey);
  if (ids.length === 0) return null;
  const available = new Set(ids);
  for (const candidate of VULTR_FALLBACK_PRIORITY) {
    if (candidate !== exclude && available.has(candidate)) return candidate;
  }
  // No preferred model available — take any general model (skip safety/guard ones).
  return ids.find((id) => id !== exclude && !/safety|guard|content/i.test(id)) ?? null;
}

/** Auth/quota failures won't be fixed by swapping the model; everything else can be. */
function isModelSwappable(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  return status !== 401 && status !== 403 && status !== 429;
}

/**
 * Call Vultr, and if the configured model is unavailable (or its engine errors),
 * resolve a valid model from the live /models list and retry once — caching the
 * substitute so the next call goes straight to the working model.
 */
async function generateVultr(
  apiKey: string,
  desiredModel: string,
  userContent: string,
  systemContent: string | undefined,
  opts: ResolvedOptions,
): Promise<string> {
  const model = resolvedModels.get(desiredModel) ?? desiredModel;
  try {
    return await callVultr(apiKey, model, userContent, systemContent, opts);
  } catch (err) {
    if (!isModelSwappable(err)) throw err;
    const fallback = await pickValidModel(apiKey, model);
    if (!fallback || fallback === model) throw err;
    log(`Vultr model '${model}' unavailable — falling back to '${fallback}'.`);
    resolvedModels.set(desiredModel, fallback);
    return await callVultr(apiKey, fallback, userContent, systemContent, opts);
  }
}

/**
 * Reasoning models (DeepSeek, Kimi, etc.) emit chain-of-thought wrapped in
 * <think>…</think> (or <reasoning>…</reasoning>) before the real answer.
 * Strip those blocks so downstream JSON parsers only see the actual output.
 */
function stripThinkingTokens(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .trim();
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
      ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!res.ok) {
    const err = new Error(`Vultr ${res.status}: ${await res.text()}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  // Reasoning models (DeepSeek, Kimi, etc.) may separate thinking from the
  // final answer using various field names. Read all of them so we never miss
  // the actual output.
  const data = (await res.json()) as {
    choices?: {
      message?: {
        content?: string | null;
        reasoning?: string | null;
        reasoning_content?: string | null;
      };
    }[];
  };
  const msg = data.choices?.[0]?.message;

  const content = msg?.content?.trim() ?? '';
  const reasoning = (msg?.reasoning_content ?? msg?.reasoning ?? '').trim();

  // Log the field presence so debugging is instant if parsing fails again.
  log(`Vultr response — content: ${content.length} chars, reasoning: ${reasoning.length} chars, jsonMode: ${opts.jsonMode}`);

  // When jsonMode is on, pick the field that actually holds JSON.
  // Reasoning models often put CoT in content and JSON in reasoning_content,
  // or vice-versa. Prefer whichever starts with '{'.
  if (opts.jsonMode) {
    if (content.startsWith('{')) return stripThinkingTokens(content);
    if (reasoning.startsWith('{')) return stripThinkingTokens(reasoning);

    // Neither field starts with '{' — try to extract a JSON object from either.
    const fromContent = extractFirstJson(content);
    if (fromContent) return fromContent;
    const fromReasoning = extractFirstJson(reasoning);
    if (fromReasoning) return fromReasoning;

    // Last resort: return whichever is non-empty (parseJson in callers will
    // attempt repair). Prefer content.
    log('Vultr response — WARNING: jsonMode requested but no JSON object found in either field.');
  }

  const raw = content || reasoning;
  return stripThinkingTokens(raw);
}

/** Try to pull the first balanced JSON object out of a string of mixed text. */
function extractFirstJson(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}
