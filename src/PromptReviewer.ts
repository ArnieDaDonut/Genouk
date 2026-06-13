import { AIProvider } from './AIProvider';
import { gatherRepoContext } from './RepoContext';

export interface PromptReviewResult {
  isFinished: boolean;
  score: number; // 0-100
  feedback: string;
  improvedPrompt: string;
  tokenIssues: string[]; // specific weaknesses found
  suggestions: string[]; // optional, high-value additions the developer might consider
  estimatedOriginalTokens: number;
  estimatedImprovedTokens: number;
}

const SYSTEM_PROMPT = `You are a blunt, senior prompt engineer reviewing a prompt a developer is about to send to a coding LLM. Your job is to make the prompt actually work, not to flatter it.

You are given REPOSITORY CONTEXT (languages, dependencies, file tree, recent commits, and possibly the file the developer is currently editing). Use it to make educated guesses about what the developer is really trying to get the LLM to do, then judge the prompt against that intent. State key assumptions in one short line each — do not ask questions.

Evaluate the prompt for these weaknesses, and for each one you find, say WHY it matters (one line):
- Ambiguity — vague nouns/verbs the model will guess at.
- Missing constraints — no language/framework/file/style boundaries (cross-check against the repo context).
- Missing output format — unclear what shape the answer should take.
- Missing context — facts the model needs that the prompt withholds.
- Unverifiable success criteria — no way to tell if the output is correct.
- Token waste — politeness padding, redundancy, filler, restating the obvious.

Scoring (0-100), be strict and earn it:
- 0-39: broken — the model will likely produce the wrong thing.
- 40-69: workable but will need rework; real weaknesses remain.
- 70-89: solid; minor gaps.
- 90-96: precise, constrained, verifiable. Rare. 96 is the realistic ceiling — never score above 96, because no prompt is perfect.
Do not inflate. Do not pad with praise. If the prompt is bad, say it is bad and exactly why.

Then rewrite it into a STRONG, DETAILED prompt — do not just trim the original. Expand it into a production-grade prompt the developer can paste and run. The rewrite must:
- Open with the role/goal and the relevant context (grounded in the repo: language, framework, target file/area when inferable).
- Spell out concrete constraints: language/version, framework conventions, files to touch, style, what NOT to do.
- State an explicit, structured output format (e.g. "return the full file", "return a unified diff", "respond with sections X/Y/Z").
- Give step-by-step expectations or a checklist when the task has multiple parts.
- End with verifiable success criteria (how the developer will know the output is correct).
Favor completeness and precision over brevity — it is fine for the rewrite to be noticeably longer than the original if that detail removes ambiguity. Only fold in assumptions you are confident about; leave genuinely optional choices for the suggestions list below.

"suggestions" is a list of 2-5 OPTIONAL, high-value additions the developer might want to make but that you deliberately did NOT bake into the rewrite (because they require a decision only they can make). Phrase each as an invitation, e.g. "Consider naming the exact target file so the model doesn't guess", "If you have a test framework, ask for tests too", "Add an example of the desired output shape". Make them specific to this prompt and repo, not generic.

Estimate token counts as words * 1.3 (the UI recomputes these from the actual text, so approximate is fine).

"feedback" must be a short, direct critique (2-5 sentences) that names the biggest weakness, why it matters, and what the rewrite fixes — referencing something real from the repo context when possible.
"tokenIssues" must be specific, concrete findings (e.g. 'No target file named — model must guess where this React component lives'), not generic advice.
"isFinished" is true only when the prompt is already strong (score >= 90) and needs no rewrite.

Reply with ONLY a valid JSON object, ,fmdsf smdf s,mf s,dno markdown fences:
{"score":number,"feedback":"string","improvedPrompt":"string","tokenIssues":["string"],"suggestions":["string"],"estimatedOriginalTokens":number,"estimatedImprovedTokens":number,"isFinished":boolean}`;

export class PromptReviewer {
  async reviewPrompt(prompt: string): Promise<PromptReviewResult> {
    const ai = AIProvider.getInstance();

    let repoContext = '';
    try {
      repoContext = await gatherRepoContext({ includeActiveFile: true });
    } catch {
      repoContext = 'No repository context available.';
    }

    const userContent = `REPOSITORY CONTEXT (use it to infer intent; state assumptions briefly, then give precise feedback):\n${repoContext}\n\nPROMPT TO REVIEW:\n${prompt}`;

    const resultText = await ai.generateContent(userContent, SYSTEM_PROMPT);

    try {
      const cleaned = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned) as PromptReviewResult;
      // No prompt is perfect — cap the score at a realistic 96 (and floor at 0).
      parsed.score = Math.max(0, Math.min(96, Math.round(parsed.score)));
      return parsed;
    } catch (e) {
      throw new Error('Failed to parse AI response.');
    }
  }
}
