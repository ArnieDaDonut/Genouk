import { GoogleGenerativeAI } from '@google/generative-ai';
import { ExplanationRequest, ExplanationResult } from './types';
import { buildPrompt } from './contextExtractor';
import { logger } from '../shared/logger';

let _client: GoogleGenerativeAI | null = null;

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
 * Generate a full explanation (non-streaming) from Gemini 1.5 Flash.
 * Returns a structured ExplanationResult parsed from the markdown response.
 */
export async function explainCode(
  req: ExplanationRequest,
  apiKey: string
): Promise<ExplanationResult> {
  const client = getClient(apiKey);
  const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });
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
  const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });
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
  const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `In ONE sentence (max 20 words), what does this ${language} code do? No preamble, just the sentence.\n\n\`\`\`${language}\n${code.slice(0, 500)}\n\`\`\``;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    logger.warn('Code Teacher: quick summary failed', err);
    return 'Press Cmd+Shift+E for a full explanation.';
  }
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
