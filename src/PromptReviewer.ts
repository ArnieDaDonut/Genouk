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
    const systemPrompt = `You are an expert prompt engineer specializing in token efficiency for AI coding assistants.

Analyze the user's draft prompt on two axes:
1. CLARITY — Is it specific, actionable, and well-contextualized?
2. TOKEN EFFICIENCY — Identify and eliminate: filler phrases ("please", "could you", "I was wondering"), redundant context, over-explanation, politeness padding, vague qualifiers ("a bit", "kind of", "maybe").

Rules for the improved prompt:
- Use imperative voice ("Refactor X" not "Could you please refactor X")
- Strip all filler and social padding
- Consolidate repeated ideas into one clear statement
- Include only context that changes the AI's behavior
- Prefer specific technical terms over vague descriptions
- Aim for at least 20% token reduction without losing meaning

Estimate token counts using: words * 1.3 (round to nearest integer).

Respond ONLY with a valid JSON object:
{
  "isFinished": boolean,
  "score": number (0-100, below 80 = not finished),
  "feedback": "string (what's missing or unclear)",
  "improvedPrompt": "string (rewritten, token-efficient version)",
  "tokenIssues": ["array of specific wasteful patterns found, e.g. 'Filler phrase: could you please'"],
  "estimatedOriginalTokens": number,
  "estimatedImprovedTokens": number
}`;

    const query = `${systemPrompt}\n\nUser's Draft Prompt:\n${prompt}`;
    const resultText = await ai.generateContent(query);

    try {
      const cleaned = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned) as PromptReviewResult;
    } catch (e) {
      throw new Error("Failed to parse AI response.");
    }
  }
}
