import { jsonrepair } from 'jsonrepair';
import { AIProvider } from './AIProvider';
import { gatherRepoContext } from './RepoContext';
import { PromptReviewResult } from './shared/types';

export type { PromptReviewResult };

/** Just the rewrite half of a review — produced by the slower phase-2 call. */
export interface PromptRewriteResult {
  improvedPrompt: string;
  suggestions: string[];
}

// Shared preamble: both phases get the same repo grounding instructions so their
// judgement is consistent.
const CONTEXT_PREAMBLE = `You are given REPOSITORY CONTEXT (languages, dependencies, file tree, recent commits, and possibly the file the developer is currently editing). Use it to make educated guesses about what the developer is really trying to get the LLM to do, then judge the prompt against that intent. State key assumptions in one short line each — do not ask questions.`;

// Phase 1 — fast. Only the score + critique + weaknesses. Kept deliberately small
// so it returns almost immediately and the user sees a score without waiting for
// the full rewrite.
const ASSESS_SYSTEM = `You are a blunt, senior prompt engineer reviewing a prompt a developer is about to send to a coding LLM. Your job is to judge it honestly, fast.

${CONTEXT_PREAMBLE}

Evaluate the prompt for these weaknesses, and for each one you find, say WHY it matters (one line):
- Ambiguity — vague nouns/verbs the model will guess at.
- Missing constraints — no language/framework/file/style boundaries (cross-check against the repo context).
- Missing output format — unclear what shape the answer should take.
- Missing context — facts the model needs that the prompt withholds.
- Unverifiable success criteria — no way to tell if the output is correct.
- Token waste — politeness padding, redundancy, filler, restating the obvious.

Scoring (0-100), be strict and earn it. Start from 0 and add points only for signal the prompt actually provides — do NOT start from the middle and deduct:
- 0-14: near-useless. No language/framework named, no target file/area, no output format, no constraints, no success criteria — the model must invent the entire task from scratch. A bare wish like "make a website for me", "fix my code", or "build an app" lives here; score it 3-8, not 15.
- 15-39: broken. One faint signal (e.g. a vague domain) but still missing most of language/framework/files/output/constraints; the model will likely produce the wrong thing.
- 40-69: workable but will need rework; real weaknesses remain.
- 70-89: solid; minor gaps.
- 90-96: precise, constrained, verifiable. Rare. 96 is the realistic ceiling — never score above 96, because no prompt is perfect.
Each missing dimension (language/framework, target file/area, output format, constraints, verifiable success criteria) should cost real points — a prompt missing four or five of them cannot exceed the low teens, no matter how polite or grammatical it is. Do not inflate. Do not pad with praise. If the prompt is bad, say it is bad and exactly why.

"feedback" must be a short, direct critique (2-5 sentences) that names the biggest weakness, why it matters, and what a rewrite should fix — referencing something real from the repo context when possible.
"tokenIssues" must be specific, concrete findings (e.g. 'No target file named — model must guess where this React component lives'), not generic advice.
"isFinished" is true only when the prompt is already strong (score >= 90) and needs no rewrite.

CRITICAL: Your entire response must be a single JSON object. Do NOT output reasoning, thinking, analysis, or any text before or after the JSON. Start your response with { and end with }.

Reply with ONLY this JSON structure:
{"score":number,"feedback":"string","tokenIssues":["string"],"isFinished":boolean}`;

// Phase 2 — heavier. The full production-grade rewrite plus optional suggestions.
// Runs in parallel with phase 1 so it does not delay the score.
const REWRITE_SYSTEM = `You are a blunt, senior prompt engineer. A developer is about to send the prompt below to a coding LLM. Rewrite it into a STRONG, DETAILED prompt — do not just trim the original.

${CONTEXT_PREAMBLE}

Expand it into a production-grade prompt the developer can paste and run. The rewrite must:
- Open with the role/goal and the relevant context (grounded in the repo: language, framework, target file/area when inferable).
- Spell out concrete constraints: language/version, framework conventions, files to touch, style, what NOT to do.
- State an explicit, structured output format (e.g. "return the full file", "return a unified diff", "respond with sections X/Y/Z").
- Give step-by-step expectations or a checklist when the task has multiple parts.
- End with verifiable success criteria (how the developer will know the output is correct).
Be precise but tight: include every constraint that removes ambiguity, but say each thing once and cut filler — aim for a focused prompt, not a long one. Only fold in assumptions you are confident about; leave genuinely optional choices for the suggestions list below.

"suggestions" is a list of 2-5 OPTIONAL, high-value ideas the developer might want to act on. These fall into TWO kinds, and you may mix them:
1. PROMPT additions you deliberately did NOT bake into the rewrite (because they require a decision only the developer can make), phrased as an invitation, e.g. "Consider naming the exact target file so the model doesn't guess", "If you have a test framework, ask for tests too", "Add an example of the desired output shape".
2. CODEBASE improvements unrelated to the prompt — things you noticed in the REPOSITORY CONTEXT that would benefit the code overall regardless of this task: missing tests, an absent lint/format setup, risky or outdated dependencies, an empty README, dead/duplicated areas, weak error handling, missing types, build/CI gaps, etc. Prefix these with "Codebase: " so they are visually distinct, e.g. "Codebase: there's no lint script wired up — adding ESLint would catch issues npm run compile misses".
Make every suggestion specific to THIS prompt and repo, grounded in the actual context (filenames, deps, commits). No generic advice. It is fine for some or all suggestions to be of kind 2 if the prompt itself needs little, but always include at least one codebase-improvement idea when the context reveals one.

CRITICAL: Your entire response must be a single JSON object. Do NOT output reasoning, thinking, analysis, or any text before or after the JSON. Start your response with { and end with }.

Reply with ONLY this JSON structure:
{"improvedPrompt":"string","suggestions":["string"]}`;

function parseJson(resultText: string): any {
  const cleaned = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
  // Fast path: the whole thing is already valid JSON.
  try {
    return JSON.parse(cleaned);
  } catch {
    // fall through to recovery
  }

  // Models sometimes wrap the object in prose ("Here's the review: {…}\n\nHope that
  // helps!"), so start from the first brace and prefer the slice up to the last one.
  const start = cleaned.indexOf('{');
  if (start === -1) throw new SyntaxError('No JSON object found in AI response.');
  const body = cleaned.slice(start);
  const lastBrace = body.lastIndexOf('}');

  // Candidates, best first: the trimmed {…} (drops trailing prose), then the raw
  // body (its closing brace is missing when the response was cut off mid-stream).
  const candidates = lastBrace > 0 ? [body.slice(0, lastBrace + 1), body] : [body];

  // jsonrepair fixes the failure modes the models actually produce: unescaped quotes
  // inside the feedback string, smart quotes, trailing commas, and an object cut off
  // when the response hit the token limit. It closes dangling strings/braces and
  // escapes stray quotes, so we recover the full score + feedback instead of erroring.
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(jsonrepair(candidate));
      // A trailing-prose repair can yield an array of values — take the first object.
      if (Array.isArray(parsed)) {
        const obj = parsed.find((v) => v && typeof v === 'object' && !Array.isArray(v));
        if (obj) return obj;
        continue;
      }
      return parsed;
    } catch {
      // try the next candidate
    }
  }
  throw new SyntaxError('Could not recover JSON from AI response.');
}

export class PromptReviewer {
  // Repo context (tree walk + `git log` + active file) barely changes between
  // back-to-back reviews, but gathering it gates the score the user is waiting on.
  // Cache it briefly so a flurry of reviews reuses one gather instead of re-walking
  // the workspace each time.
  private contextCache?: { value: string; at: number };
  private static readonly CONTEXT_TTL_MS = 15_000;

  /**
   * Phase 1: the fast score + critique. Small output so it returns quickly and
   * the user gets a score without waiting for the full rewrite. The heavy rewrite
   * is produced separately by {@link rewritePrompt}, ideally in parallel.
   */
  async assessPrompt(prompt: string, repoContext?: string): Promise<PromptReviewResult> {
    const ai = AIProvider.getInstance();
    const ctx = repoContext ?? (await this.repoContext());
    const userContent = `REPOSITORY CONTEXT (use it to infer intent; state assumptions briefly, then give precise feedback):\n${ctx}\n\nPROMPT TO REVIEW:\n${prompt}`;

    // Cap output tightly — the critique is a handful of sentences plus a short
    // list, so a small budget keeps latency down without truncating real answers.
    // Low temperature keeps the score stable run-to-run (same prompt → same score)
    // and trims sampling latency.
    const resultText = await ai.generateContent(userContent, ASSESS_SYSTEM, {
      maxTokens: 2048,
      temperature: 0.1,
      jsonMode: true,
    });

    try {
      const parsed = parseJson(resultText);
      return {
        // No prompt is perfect — cap the score at a realistic 96 (and floor at 0).
        score: Math.max(0, Math.min(96, Math.round(parsed.score ?? 0))),
        feedback: parsed.feedback ?? '',
        tokenIssues: Array.isArray(parsed.tokenIssues) ? parsed.tokenIssues : [],
        isFinished: Boolean(parsed.isFinished),
        // Filled in by phase 2.
        improvedPrompt: '',
        suggestions: [],
        estimatedOriginalTokens: 0,
        estimatedImprovedTokens: 0,
        rewriting: true,
      };
    } catch (err) {
      console.error('[Genouk] Prompt review JSON parse failed. Raw response:', resultText);
      throw new Error('Failed to parse AI response.');
    }
  }

  /** Phase 2: the heavy, production-grade rewrite plus optional suggestions. */
  async rewritePrompt(prompt: string, repoContext?: string): Promise<PromptRewriteResult> {
    const ai = AIProvider.getInstance();
    const ctx = repoContext ?? (await this.repoContext());
    const userContent = `REPOSITORY CONTEXT (use it to infer intent; state assumptions briefly):\n${ctx}\n\nPROMPT TO REWRITE:\n${prompt}`;

    // maxTokens caps the longest call in the whole feature — paired with the "concise"
    // instruction in REWRITE_SYSTEM, it keeps the rewrite snappy on Vultr's reasoning
    // model without truncating a real answer (parseJson also repairs a cut-off object).
    const resultText = await ai.generateContent(userContent, REWRITE_SYSTEM, {
      maxTokens: 4096,
      jsonMode: true,
    });

    try {
      const parsed = parseJson(resultText);
      return {
        improvedPrompt: parsed.improvedPrompt ?? '',
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      };
    } catch (err) {
      console.error('[Genouk] Prompt review JSON parse failed. Raw response:', resultText);
      throw new Error('Failed to parse AI response.');
    }
  }

  /** Best-effort repo context; shared by both phases so it is gathered once. */
  async repoContext(): Promise<string> {
    const cached = this.contextCache;
    if (cached && Date.now() - cached.at < PromptReviewer.CONTEXT_TTL_MS) {
      return cached.value;
    }
    try {
      const value = await gatherRepoContext({ includeActiveFile: true });
      this.contextCache = { value, at: Date.now() };
      return value;
    } catch {
      return 'No repository context available.';
    }
  }
}
