import * as vscode from 'vscode';
import { BlastNode } from './types';
import { quickSummary } from '../code-teacher/geminiClient';
import { getGeminiApiKey } from '../shared/config';
import { getSurroundingContext } from '../shared/utils';
import { logger } from '../shared/logger';

/** Thrown when no API key is configured, so callers can degrade quietly. */
export class NoApiKeyError extends Error {
  constructor() {
    super('no-gemini-api-key');
    this.name = 'NoApiKeyError';
  }
}

// ── Request throttle ─────────────────────────────────────────────────────────
// The sidebar can ask us to explain many nodes at once when a level is expanded.
// Firing them in parallel instantly trips Gemini's free-tier per-minute limit
// (HTTP 429). We serialise calls and space them out so we stay under the cap.
// ~4.5s ≈ 13 req/min, safely below gemini-2.0-flash's ~15 req/min free tier.
const MIN_GAP_MS = 4500;
let chain: Promise<unknown> = Promise.resolve();
let lastCallAt = 0;

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const result = chain.then(async () => {
    const wait = Math.max(0, MIN_GAP_MS - (Date.now() - lastCallAt));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
    return fn();
  });
  // Keep the chain alive even if one call rejects.
  chain = result.then(() => undefined, () => undefined);
  return result;
}

/**
 * Produce a one-sentence, plain-English explanation of what a blast-radius
 * node does — the "learning tool" half of Blast Radius. Reuses Code Teacher's
 * `quickSummary` so both features share one prompt/model path.
 *
 * Uses a few lines of surrounding code (not just the symbol token) so the model
 * can describe the *caller's* behaviour, not just the bare identifier.
 */
export async function explainNode(node: BlastNode): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new NoApiKeyError();

  const doc = await vscode.workspace.openTextDocument(node.uri);
  const snippet = getSurroundingContext(doc, node.range, 6);

  logger.info(`Blast Radius: explaining "${node.symbol}" (depth ${node.depth})`);
  return throttled(() => quickSummary(snippet, doc.languageId, apiKey));
}
