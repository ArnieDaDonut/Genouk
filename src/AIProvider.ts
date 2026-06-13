import * as vscode from 'vscode';
import Groq from 'groq-sdk';

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

  public async generateContent(prompt: string): Promise<string> {
    if (!this.client) {
      throw new Error('Groq API key is not configured. Please add it in settings (jarvis.groqApiKey).');
    }
    const completion = await this.client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
    });
    return completion.choices[0]?.message?.content ?? '';
  }
}
