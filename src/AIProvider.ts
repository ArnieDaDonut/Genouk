import * as vscode from 'vscode';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

export class AIProvider {
  private static instance: AIProvider;
  private genAI?: GoogleGenerativeAI;
  private model?: GenerativeModel;

  private constructor() {
    this.initialize();
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('jarvis.geminiApiKey')) {
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
    const apiKey = vscode.workspace.getConfiguration('jarvis').get<string>('geminiApiKey');
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
    } else {
      this.genAI = undefined;
      this.model = undefined;
    }
  }

  public async generateContent(prompt: string): Promise<string> {
    if (!this.model) {
      throw new Error('Gemini API key is not configured. Please add it in settings (jarvis.geminiApiKey).');
    }
    const result = await this.model.generateContent(prompt);
    return result.response.text();
  }
}
