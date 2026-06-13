import * as vscode from 'vscode';
import Groq from 'groq-sdk';

export interface GenerateOptions {
  /** Override the configured max_tokens for this call. */
  maxTokens?: number;
  /** Override the configured temperature for this call. */
  temperature?: number;
  /** Override the configured model for this call. */
  model?: string;
}

const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.4;

export class AIProvider {
  private static instance: AIProvider;
  private client?: Groq;

  private constructor() {
    this.initialize();
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('jarvis.groqApiKey')) {
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
    const apiKey = vscode.workspace.getConfiguration('jarvis').get<string>('groqApiKey');
    if (apiKey) {
      this.client = new Groq({ apiKey });
    } else {
      this.client = undefined;
    }
  }

  /**
   * Generate a completion from a system/user message pair. The system message
   * carries the reviewer's role and rules; the user message carries the payload
   * (prompt, diff, repo context). Model, token budget and temperature default to
   * the user's settings and can be overridden per call.
   */
  public async generateContent(
    userContent: string,
    systemContent?: string,
    options: GenerateOptions = {},
  ): Promise<string> {
    if (!this.client) {
      throw new Error('Groq API key is not configured. Please add it in settings (jarvis.groqApiKey).');
    }

    const config = vscode.workspace.getConfiguration('jarvis');
    const model = options.model ?? (config.get<string>('model') || DEFAULT_MODEL);
    const maxTokens = options.maxTokens ?? config.get<number>('maxTokens') ?? DEFAULT_MAX_TOKENS;
    const temperature = options.temperature ?? config.get<number>('temperature') ?? DEFAULT_TEMPERATURE;

    const messages: { role: 'system' | 'user'; content: string }[] = [];
    if (systemContent) messages.push({ role: 'system', content: systemContent });
    messages.push({ role: 'user', content: userContent });

    const completion = await this.client.chat.completions.create({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    });
    return completion.choices[0]?.message?.content ?? '';
  }
}
