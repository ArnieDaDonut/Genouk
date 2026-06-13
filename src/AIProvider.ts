import * as vscode from 'vscode';
import Groq from 'groq-sdk';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import * as path from 'path';

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
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.4;

/** One backend Jarvis can call. Tried in order; the first that succeeds wins. */
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
 * Single entry point for all model calls. It keeps an ordered list of free
 * providers and falls through to the next one whenever a call fails (rate
 * limits, outages, missing keys). Groq is primary (fast, generous free tier);
 * Google Gemini is the free fallback. Callers are unchanged — they still call
 * `getInstance().generateContent(...)`.
 */
export class AIProvider {
  private static instance: AIProvider;
  private groq?: Groq;
  private gemini?: GoogleGenAI;

  private constructor() {
    this.initialize();
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('jarvis.groqApiKey') || e.affectsConfiguration('jarvis.geminiApiKey')) {
        this.initialize();
      }
    });
  }

  public static getInstance(): AIProvider {
    if (!AIProvider.instance) {
      AIProvider.instance = new AIProvider();
    }
    return AIProvider.instance;
  }

  private initialize() {
    const config = vscode.workspace.getConfiguration('jarvis');

    const groqKey = config.get<string>('groqApiKey') || process.env.GROQ_API_KEY;
    // maxRetries: the SDK retries 429/5xx with exponential backoff and honors
    // the Retry-After header — bumped from the default 2 so a brief rate-limit
    // spike self-heals before we fall through to Gemini.
    this.groq = groqKey ? new Groq({ apiKey: groqKey, maxRetries: 4 }) : undefined;

    const geminiKey = config.get<string>('geminiApiKey') || process.env.GEMINI_API_KEY;
    this.gemini = geminiKey ? new GoogleGenAI({ apiKey: geminiKey }) : undefined;
  }

  /** Providers to try, in order, given the keys currently configured. */
  private providers(): Provider[] {
    const config = vscode.workspace.getConfiguration('jarvis');
    const list: Provider[] = [];

    if (this.groq) {
      const groq = this.groq;
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

    if (this.gemini) {
      const gemini = this.gemini;
      const geminiModel = config.get<string>('geminiModel') || DEFAULT_GEMINI_MODEL;
      list.push({
        name: 'Gemini',
        generate: async (userContent, systemContent, opts) => {
          const response = await gemini.models.generateContent({
            model: geminiModel,
            contents: userContent,
            config: {
              systemInstruction: systemContent,
              maxOutputTokens: opts.maxTokens,
              temperature: opts.temperature,
            },
          });
          return response.text ?? '';
        },
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
    const config = vscode.workspace.getConfiguration('jarvis');
    const opts: ResolvedOptions = {
      maxTokens: options.maxTokens ?? config.get<number>('maxTokens') ?? DEFAULT_MAX_TOKENS,
      temperature: options.temperature ?? config.get<number>('temperature') ?? DEFAULT_TEMPERATURE,
      model: options.model,
    };

    const providers = this.providers();
    if (providers.length === 0) {
      throw new Error(
        'No AI provider is configured. Add a free Groq key (jarvis.groqApiKey) or Gemini key (jarvis.geminiApiKey) in settings.',
      );
    }

    let lastError: unknown;
    for (const provider of providers) {
      try {
        const text = await provider.generate(userContent, systemContent, opts);
        if (text.trim()) return text;
        lastError = new Error(`${provider.name} returned an empty response.`);
      } catch (err) {
        lastError = err;
        console.warn(`[Genouk] ${provider.name} failed, trying next provider:`, err);
      }
    }

    const detail = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`All AI providers failed. Last error: ${detail}`);
  }
}
