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
}

export const TARGET_MODELS: TargetModel[] = [
  { id: 'claude-opus-4', label: 'Claude Opus 4', provider: 'Anthropic', contextWindow: 200_000, charsPerToken: 3.8 },
  { id: 'claude-sonnet-4', label: 'Claude Sonnet 4', provider: 'Anthropic', contextWindow: 200_000, charsPerToken: 3.8 },
  { id: 'gpt-4o', label: 'GPT-4o', provider: 'OpenAI', contextWindow: 128_000, charsPerToken: 4.0 },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini', provider: 'OpenAI', contextWindow: 128_000, charsPerToken: 4.0 },
  { id: 'gemini-2-flash', label: 'Gemini 2.0 Flash', provider: 'Google', contextWindow: 1_000_000, charsPerToken: 4.0 },
  { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', provider: 'Google', contextWindow: 2_000_000, charsPerToken: 4.0 },
  { id: 'llama-3.3-70b', label: 'Llama 3.3 70B', provider: 'Groq', contextWindow: 128_000, charsPerToken: 4.0 },
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
