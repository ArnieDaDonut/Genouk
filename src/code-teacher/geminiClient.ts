import { GoogleGenerativeAI } from '@google/generative-ai';
import { ExplanationRequest, ExplanationResult } from './types';
import { buildPrompt } from './contextExtractor';
import { logger } from '../shared/logger';

// Pinned to gemini-2.5-flash-lite: a lightweight model (plenty for one-line
// code summaries) that, crucially, has free-tier quota on the current dev key.
// Note: free-tier quota is granted per model *and* per project — some keys have
// `limit: 0` on certain models (e.g. the 2.0 line) while 2.5 works fine, so we
// pin to a model confirmed to have quota. The old `gemini-1.5-flash` was retired
// (404). Override via the model arg if you have a paid plan.
const FLASH_MODEL = 'gemini-2.5-flash-lite';

let _client: GoogleGenerativeAI | null = null;

/** Best-effort parse of the server-suggested retry delay (e.g. "10s"). */
function parseRetryDelayMs(err: unknown): number | null {
  const msg = err instanceof Error ? err.message : String(err);
  const m = msg.match(/"?retryDelay"?:\s*"?(\d+(?:\.\d+)?)s/i);
  return m ? Math.ceil(parseFloat(m[1]) * 1000) : null;
}

/** True when the error is a 429 / quota / rate-limit response. */
function isRateLimit(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b429\b|too many requests|quota|rate.?limit/i.test(msg);
}

/**
 * Run a Gemini call, retrying on 429 with the server-suggested backoff.
 * Throws the last error if it still fails — callers decide how to surface it.
 */
async function withRateLimitRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (isRateLimit(err) && attempt < retries) {
        const delay = parseRetryDelayMs(err) ?? (attempt + 1) * 3000;
        logger.warn(`Gemini rate-limited (429) — retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

function getClient(apiKey: string): GoogleGenerativeAI {
  if (!_client) {
    _client = new GoogleGenerativeAI(apiKey);
  }
  return _client;
}

/** Invalidate the cached client (e.g. when API key changes) */
export function resetClient(): void {
  _client = null;
}

/**
 * Generate a full explanation (non-streaming) from the current Gemini Flash model.
 * Returns a structured ExplanationResult parsed from the markdown response.
 */
export async function explainCode(
  req: ExplanationRequest,
  apiKey: string
): Promise<ExplanationResult> {
  const client = getClient(apiKey);
  const model = client.getGenerativeModel({ model: FLASH_MODEL });
  const prompt = buildPrompt(req);

  logger.info(`Code Teacher: Sending request to Gemini for "${req.selectedCode.slice(0, 50)}..."`);

  const result = await model.generateContent(prompt);
  const response = result.response;
  const raw = response.text();

  return parseExplanation(raw);
}

/**
 * Streaming version — yields chunks as they arrive.
 * The caller is responsible for updating the webview with each chunk.
 */
export async function* explainCodeStream(
  req: ExplanationRequest,
  apiKey: string
): AsyncGenerator<string> {
  const client = getClient(apiKey);
  const model = client.getGenerativeModel({ model: FLASH_MODEL });
  const prompt = buildPrompt(req);

  logger.info(`Code Teacher (stream): Sending request to Gemini...`);

  const streamResult = await model.generateContentStream(prompt);
  for await (const chunk of streamResult.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}

/**
 * Generate a short one-liner summary for the hover tooltip.
 * Uses a smaller, faster prompt.
 */
export async function quickSummary(
  code: string,
  language: string,
  apiKey: string
): Promise<string> {
  const client = getClient(apiKey);
  const model = client.getGenerativeModel({ model: FLASH_MODEL });

  const prompt = `In ONE sentence (max 20 words), what does this ${language} code do? No preamble, just the sentence.\n\n\`\`\`${language}\n${code.slice(0, 500)}\n\`\`\``;

  // Retries 429s; throws if it still fails so callers can show an honest state
  // (the hover provider and blast-radius explainer both catch this).
  const result = await withRateLimitRetry(() => model.generateContent(prompt));
  return result.response.text().trim();
}

/** Parse the structured markdown response from Gemini into typed fields */
function parseExplanation(raw: string): ExplanationResult {
  const extract = (header: string): string => {
    const regex = new RegExp(`##\\s*[^\\n]*${header}[^\\n]*\\n([\\s\\S]*?)(?=##|$)`, 'i');
    const match = raw.match(regex);
    return match ? match[1].trim() : '';
  };

  return {
    summary: extract('Summary'),
    detail: extract('Detailed'),
    gotchas: extract('Gotcha'),
    complexity: extract('Complexity') || undefined,
    raw,
  };
}
