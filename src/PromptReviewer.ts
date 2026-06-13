import { AIProvider } from './AIProvider';

export interface PromptReviewResult {
  isFinished: boolean;
  score: number; // 0-100
  feedback: string;
  improvedPrompt: string;
}

export class PromptReviewer {
  async reviewPrompt(prompt: string): Promise<PromptReviewResult> {
    const ai = AIProvider.getInstance();
    const systemPrompt = `You are an expert prompt engineer and code reviewer.
The user has written a draft prompt for an AI coding assistant.
Your goal is to evaluate if this prompt is "finished" (clear, specific, contains context, actionable).
Provide a score from 0 to 100 on how ready it is.
If it's below 80, isFinished should be false.
Provide constructive feedback on what's missing.
Finally, provide an improved, rewritten version of the prompt that is ready to be sent to an AI.

Respond ONLY with a valid JSON object matching this schema:
{
  "isFinished": boolean,
  "score": number,
  "feedback": "string",
  "improvedPrompt": "string"
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
