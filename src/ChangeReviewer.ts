import * as vscode from 'vscode';
import { AIProvider } from './AIProvider';
import { gatherRepoContext } from './RepoContext';
import * as cp from 'child_process';
import * as util from 'util';

const exec = util.promisify(cp.exec);

const SYSTEM_PROMPT = `You are a senior code reviewer reviewing an uncommitted git diff. You are given REPOSITORY CONTEXT (languages, dependencies, file tree, recent commits) — use it to judge changes against how this project actually works, and make an educated guess about the intent of the change before critiquing it.

Output format (plain text, no markdown headers, no code fences):

INTENT: <one or two sentences: your best guess at what this change is trying to accomplish, based on the diff and repo context>

Then a list of findings. Each finding is ONE line that begins with a severity tag, names the specific file (and the relevant symbol/hunk), states the problem, then the fix after an arrow:

BLOCKER: path/to/file.ts (functionName) — <what is wrong and why it breaks> → <concrete fix>
WARNING: path/to/file.ts — <real risk: edge case, regression, perf, security> → <fix>
NIT: path/to/file.ts — <minor style/clarity issue> → <suggestion>

Rules:
- Rank by severity, blockers first. Use BLOCKER only for things that are actually broken or unsafe; WARNING for real risks; NIT for minor polish.
- Every finding must point at a specific file from the diff. No generic advice ("add tests", "handle errors") unless tied to a concrete line.
- Be direct. Do not pad. If the change is clean, say so in one line after INTENT and list only genuine nits (or none).
- Do not restate the diff back to the user.`;

export class ChangeReviewer {
  async reviewChanges(): Promise<string> {
    const ai = AIProvider.getInstance();

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error('No workspace folder open to check diff.');
    }

    const cwd = workspaceFolders[0].uri.fsPath;
    let diffOutput = '';
    try {
      // Include staged changes too so a review before commit sees everything.
      const { stdout } = await exec('git diff HEAD', { cwd, maxBuffer: 10 * 1024 * 1024 });
      diffOutput = stdout;
    } catch (e) {
      // `git diff HEAD` fails on a repo with no commits yet — fall back to plain diff.
      try {
        const { stdout } = await exec('git diff', { cwd, maxBuffer: 10 * 1024 * 1024 });
        diffOutput = stdout;
      } catch {
        throw new Error('Failed to get git diff. Are you in a git repository?');
      }
    }

    if (!diffOutput.trim()) {
      return 'No uncommitted changes found. Make some changes before requesting a review.';
    }

    // Keep the diff within a sane budget; very large diffs get truncated.
    const MAX_DIFF = 24000;
    let diffForModel = diffOutput;
    let truncatedNote = '';
    if (diffForModel.length > MAX_DIFF) {
      diffForModel = diffForModel.slice(0, MAX_DIFF);
      truncatedNote = '\n…[diff truncated; review covers the changes shown above]';
    }

    let repoContext = '';
    try {
      repoContext = await gatherRepoContext({ includeActiveFile: false });
    } catch {
      repoContext = 'No repository context available.';
    }

    const userContent = `REPOSITORY CONTEXT:\n${repoContext}\n\nGIT DIFF:\n${diffForModel}${truncatedNote}`;

    return ai.generateContent(userContent, SYSTEM_PROMPT);
  }
}

