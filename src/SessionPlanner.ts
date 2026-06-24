import { jsonrepair } from 'jsonrepair';
import { AIProvider } from './AIProvider';
import { SessionTask, SessionPlan } from './shared/types';

export type { SessionTask, SessionPlan };

const DIFFICULTIES: SessionTask['difficulty'][] = ['easy', 'medium', 'hard'];

const PLAN_SCHEMA = `{
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

export class SessionPlanner {
  async generateSessionPlan(goal: string): Promise<SessionPlan> {
    const ai = AIProvider.getInstance();
    const systemPrompt = `You are GENOUK, an expert software architect and assistant.
Break down the user's coding session goal into a structured step-by-step implementation plan.
Order the tasks in the sequence they should actually be done (dependencies first).
Provide a total estimated duration, and a clear list of specific, granular subtasks.

Each task must have:
- A unique ID (e.g. "task-1", "task-2")
- A short, action-oriented title (e.g. "Create User Model")
- A detailed, technical description of what to do
- Estimated duration in minutes (realistic, between 5 and 120)
- Difficulty level: "easy", "medium", or "hard"
- Default status: "todo"

CRITICAL: Your entire response must be a single JSON object. Do NOT output reasoning, thinking, analysis, or any text before or after the JSON. Start your response with { and end with }.

Respond with ONLY a valid JSON object matching this schema:
${PLAN_SCHEMA}`;

    const resultText = await ai.generateContent(`User's Coding Goal:\n${goal}`, systemPrompt, { jsonMode: true });
    const raw = parsePlanJson(resultText);
    return normalizePlan(raw, goal);
  }

  /**
   * Generate additional tasks for an existing plan. The model is told what's
   * already planned so it appends complementary work instead of repeating it.
   * Returns only the new tasks (with ids guaranteed unique against the plan).
   */
  async extendSessionPlan(plan: SessionPlan, instruction: string): Promise<SessionTask[]> {
    const ai = AIProvider.getInstance();
    const existing = plan.tasks.map((task) => `- ${task.title}: ${task.description}`).join('\n');
    const systemPrompt = `You are GENOUK, an expert software architect.
The user already has a session plan and wants to add more tasks to it.
Generate ONLY new tasks that are not already covered. Do not repeat existing tasks.

Respond ONLY with a valid JSON object: { "tasks": [ { "id", "title", "description", "estimatedMinutes", "difficulty", "status": "todo" } ] }

CRITICAL: Your entire response must be a single JSON object. Do NOT output reasoning, thinking, or analysis. Start with { and end with }.`;

    const userPrompt = `Session goal: ${plan.goal}

Existing tasks:
${existing || '(none yet)'}

What to add: ${instruction}`;

    const resultText = await ai.generateContent(userPrompt, systemPrompt, { jsonMode: true });
    const raw = parsePlanJson(resultText);
    const existingIds = new Set(plan.tasks.map((task) => task.id));
    return normalizeTasks(raw?.tasks, existingIds, 'add');
  }
}

/**
 * Best-effort extraction of a JSON object from a model response. LLMs routinely
 * wrap JSON in ```fences```, add stray prose, or emit minor syntax slips, so we
 * strip fences, slice to the outermost braces, and repair before parsing.
 */
function parsePlanJson(text: string): any {
  const withoutFences = text.replace(/```(?:json)?/gi, '').trim();
  const start = withoutFences.indexOf('{');
  const end = withoutFences.lastIndexOf('}');
  const candidate = start !== -1 && end !== -1 && end > start
    ? withoutFences.slice(start, end + 1)
    : withoutFences;

  try {
    return JSON.parse(candidate);
  } catch {
    try {
      return JSON.parse(jsonrepair(candidate));
    } catch {
      throw new Error('Genouk could not read the session plan the model returned. Try rephrasing your goal.');
    }
  }
}

/** Coerce a loosely-typed parsed object into a valid SessionPlan. */
function normalizePlan(raw: any, fallbackGoal: string): SessionPlan {
  const tasks = normalizeTasks(raw?.tasks, new Set<string>(), 'task');
  if (tasks.length === 0) {
    throw new Error('The generated plan had no tasks. Try a more specific goal.');
  }
  const totalMinutes = tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0);
  return {
    goal: typeof raw?.goal === 'string' && raw.goal.trim() ? raw.goal.trim() : fallbackGoal,
    estimatedDuration:
      typeof raw?.estimatedDuration === 'string' && raw.estimatedDuration.trim()
        ? raw.estimatedDuration.trim()
        : humanDuration(totalMinutes),
    tasks,
  };
}

/** Validate/repair a raw task array, assigning unique ids and safe defaults. */
function normalizeTasks(rawTasks: any, usedIds: Set<string>, idPrefix: string): SessionTask[] {
  if (!Array.isArray(rawTasks)) return [];
  const out: SessionTask[] = [];
  for (const raw of rawTasks) {
    const title = typeof raw?.title === 'string' ? raw.title.trim() : '';
    if (!title) continue;

    let id = typeof raw?.id === 'string' && raw.id.trim() ? raw.id.trim() : '';
    if (!id || usedIds.has(id)) id = `${idPrefix}-${usedIds.size + 1}-${Date.now().toString(36)}`;
    usedIds.add(id);

    const minutes = Number(raw?.estimatedMinutes);
    const difficulty = DIFFICULTIES.includes(raw?.difficulty) ? raw.difficulty : 'medium';
    const status = raw?.status === 'in_progress' || raw?.status === 'completed' ? raw.status : 'todo';

    out.push({
      id,
      title,
      description: typeof raw?.description === 'string' ? raw.description.trim() : '',
      estimatedMinutes: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 15,
      difficulty,
      status,
    });
  }
  return out;
}

/** "2h 15m" / "45m" from a minute total. */
function humanDuration(mins: number): string {
  if (mins <= 0) return 'unknown';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} mins`;
  if (m === 0) return `${h} ${h === 1 ? 'hour' : 'hours'}`;
  return `${h}h ${m}m`;
}
