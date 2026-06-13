import { AIProvider } from './AIProvider';

export interface PromptReviewResult {
  isFinished: boolean;
  score: number; // 0-100
  feedback: string;
  improvedPrompt: string;
  tokenIssues: string[]; // specific token-waste patterns found
  estimatedOriginalTokens: number;
  estimatedImprovedTokens: number;
}

export class PromptReviewer {
  async reviewPrompt(prompt: string): Promise<PromptReviewResult> {
    const ai = AIProvider.getInstance();
    const systemPrompt = `Rewrite the prompt below to be more concise and token-efficient. Remove filler words, politeness padding, and redundancy. Use imperative voice. Estimate token counts (words * 1.3).

Reply ONLY with JSON:
{"score":number,"feedback":"string","improvedPrompt":"string","tokenIssues":["string"],"estimatedOriginalTokens":number,"estimatedImprovedTokens":number,"isFinished":boolean}`;

    const query = `${systemPrompt}\n\nPrompt: ${prompt}`;
    const resultText = await ai.generateContent(query);

    try {
      const cleaned = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned) as PromptReviewResult;
    } catch (e) {
      throw new Error("Failed to parse AI response.");
    }
  }
}
