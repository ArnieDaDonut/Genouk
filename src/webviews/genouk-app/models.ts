/**
 * The set of models a developer might paste their prompt into. Used by the
 * Prompt tab to estimate how many tokens the prompt will cost and how much of
 * the target model's context window that fills.
 *
 * Token counts are an approximation: tokenizers differ slightly per family, so
 * we use a characters-per-token density for English text. It's a planning aid,
 * not an exact billing figure — always shown with a "~".
 */
export interface TargetModel {
  id: string;
  label: string;
  provider: string;
  /** Maximum input context window, in tokens. */
  contextWindow: number;
  /** Rough tokenizer density (characters per token) for English text. */
  charsPerToken: number;
  /** Upper bound on a single response — caps the estimated output tokens. */
  maxOutputTokens: number;
}

export const TARGET_MODELS: TargetModel[] = [
  { id: 'claude-opus-4', label: 'Claude Opus 4', provider: 'Anthropic', contextWindow: 200_000, charsPerToken: 3.8, maxOutputTokens: 32_000 },
  { id: 'claude-sonnet-4', label: 'Claude Sonnet 4', provider: 'Anthropic', contextWindow: 200_000, charsPerToken: 3.8, maxOutputTokens: 32_000 },
  { id: 'gpt-4o', label: 'GPT-4o', provider: 'OpenAI', contextWindow: 128_000, charsPerToken: 4.0, maxOutputTokens: 16_000 },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini', provider: 'OpenAI', contextWindow: 128_000, charsPerToken: 4.0, maxOutputTokens: 16_000 },
  { id: 'gemini-2-flash', label: 'Gemini 2.0 Flash', provider: 'Google', contextWindow: 1_000_000, charsPerToken: 4.0, maxOutputTokens: 8_000 },
  { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', provider: 'Google', contextWindow: 2_000_000, charsPerToken: 4.0, maxOutputTokens: 8_000 },
  { id: 'llama-3.3-70b', label: 'Llama 3.3 70B', provider: 'Groq', contextWindow: 128_000, charsPerToken: 4.0, maxOutputTokens: 32_000 },
];

export const DEFAULT_MODEL_ID = TARGET_MODELS[0].id;

export function findModel(id: string): TargetModel {
  return TARGET_MODELS.find((m) => m.id === id) ?? TARGET_MODELS[0];
}

/** Estimate the token cost of `text` for a specific target model. */
export function estimateTokensForModel(text: string, model: TargetModel): number {
  const chars = text.trim().length;
  if (!chars) return 0;
  return Math.ceil(chars / model.charsPerToken);
}

/**
 * Coding answers run larger than the instruction that triggers them, so the
 * response is the bigger half of the bill. We can't know its true size up
 * front, so estimate it as a multiple of the prompt with a floor (even a
 * one-line ask returns a paragraph + code) and the model's output cap as the
 * ceiling. Deliberately rough — always shown with a "~".
 */
const RESPONSE_RATIO = 2;
const MIN_RESPONSE_TOKENS = 400;

export function estimateResponseTokens(inputTokens: number, model: TargetModel): number {
  if (inputTokens <= 0) return 0;
  const raw = Math.max(MIN_RESPONSE_TOKENS, Math.round(inputTokens * RESPONSE_RATIO));
  return Math.min(raw, model.maxOutputTokens);
}

export interface TokenEstimate {
  /** Tokens the prompt itself costs. */
  input: number;
  /** Estimated tokens the model's response will cost. */
  output: number;
  /** input + output — what the whole exchange is expected to use. */
  total: number;
}

/** Full round-trip estimate: prompt in + expected response out. */
export function estimateTotalTokens(text: string, model: TargetModel): TokenEstimate {
  const input = estimateTokensForModel(text, model);
  const output = estimateResponseTokens(input, model);
  return { input, output, total: input + output };
}

/** Fraction (0-100) of the model's context window the prompt would consume. */
export function contextPct(tokens: number, model: TargetModel): number {
  return (tokens / model.contextWindow) * 100;
}

/** Compact window label, e.g. 128000 -> "128K", 1000000 -> "1M". */
export function formatContextWindow(tokens: number): string {
  if (tokens >= 1_000_000) return `${tokens / 1_000_000}M`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K`;
  return String(tokens);
}
