import { AIProvider } from './AIProvider';

export interface SessionTask {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  difficulty: 'easy' | 'medium' | 'hard';
  status: 'todo' | 'in_progress' | 'completed';
}

export interface SessionPlan {
  goal: string;
  estimatedDuration: string;
  tasks: SessionTask[];
}

export class SessionPlanner {
  async generateSessionPlan(goal: string): Promise<SessionPlan> {
    const ai = AIProvider.getInstance();
    const systemPrompt = `You are JARVIS, an expert software architect and assistant.
Break down the user's coding session goal into a structured step-by-step implementation plan.
Provide a total estimated duration, and a clear list of specific subtasks.

Each task must have:
- A unique ID (e.g. "task-1", "task-2")
- A short, action-oriented title (e.g. "Create User Model")
- A detailed, technical description of what to do
- Estimated duration in minutes
- Difficulty level: "easy", "medium", or "hard"
- Default status: "todo"

Respond ONLY with a valid JSON object matching this schema:
{
  "goal": "description of the session goal",
  "estimatedDuration": "e.g. 2 hours 15 mins",
  "tasks": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "estimatedMinutes": number,
      "difficulty": "easy" | "medium" | "hard",
      "status": "todo"
    }
  ]
}`;

    const query = `${systemPrompt}\n\nUser's Coding Goal:\n${goal}`;
    const resultText = await ai.generateContent(query);

    try {
      const cleaned = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned) as SessionPlan;
    } catch (e) {
      throw new Error("Failed to parse JARVIS session plan.");
    }
  }
}
