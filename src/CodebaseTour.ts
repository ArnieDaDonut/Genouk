import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AIProvider } from './AIProvider';
import { gatherRepoContext } from './RepoContext';

export interface TourStop {
  /** Feature/area name, e.g. "Prompt review pipeline". */
  title: string;
  /** Workspace-relative file path the stop centers on (clickable in the UI). */
  file: string;
  /** The key function/class/identifier in `file` to jump to and highlight. */
  symbol: string;
  /** Other relevant files for this area. */
  relatedFiles: string[];
  /** One-paragraph plain-language explanation of what this area does. */
  what: string;
  /** How it works — key functions/classes and the flow between them. */
  how: string;
}

export interface CodebaseTour {
  /** What the program does. Echoes the user's description, or Jarvis's inference. */
  summary: string;
  /** True when the user gave no description and Jarvis inferred the purpose. */
  inferred: boolean;
  /** High-level architecture narrative: layers, data flow, entry points. */
  architecture: string;
  /** Key technologies/frameworks detected. */
  techStack: string[];
  /** The ordered walkthrough of the codebase. */
  stops: TourStop[];
}

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'out', 'build', '.next', '.cache',
  'coverage', '.vscode-test', '.turbo', 'vendor', '__pycache__', '.venv',
]);

const SOURCE_EXT = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.rb', '.go', '.rs', '.java', '.kt',
  '.c', '.h', '.cpp', '.cc', '.cs', '.php', '.swift', '.scala', '.vue', '.svelte',
]);

// Files whose names suggest they are entry points or central wiring — read first.
const ENTRY_HINTS = ['extension', 'main', 'index', 'app', 'server', 'cli', 'activate', 'bootstrap'];

const MAX_FILES = 14;
const PER_FILE_CHARS = 1600;

interface RankedFile {
  rel: string;
  abs: string;
  size: number;
  score: number;
}

/** Walk the workspace and rank source files by how central they are likely to be. */
function rankSourceFiles(root: string): RankedFile[] {
  const out: RankedFile[] = [];

  const walk = (dir: string, depth: number) => {
    if (depth > 6) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        walk(abs, depth + 1);
      } else if (SOURCE_EXT.has(path.extname(entry.name).toLowerCase())) {
        let size = 0;
        try { size = fs.statSync(abs).size; } catch { /* ignore */ }
        const base = entry.name.toLowerCase();
        let score = Math.min(size / 1000, 30); // bigger files tend to carry more logic, capped
        if (ENTRY_HINTS.some((h) => base.includes(h))) score += 40;
        if (depth <= 1) score += 10; // top-level files matter more
        out.push({ rel: path.relative(root, abs), abs, size, score });
      }
    }
  };

  walk(root, 0);
  return out.sort((a, b) => b.score - a.score);
}

/** Build the deep context block: repo summary + contents of the top-ranked files. */
async function gatherTourContext(root: string): Promise<string> {
  const repo = await gatherRepoContext({ charBudget: 4000 });
  const ranked = rankSourceFiles(root).slice(0, MAX_FILES);

  const fileBlocks: string[] = [];
  for (const f of ranked) {
    try {
      const raw = fs.readFileSync(f.abs, 'utf8');
      const body = raw.length > PER_FILE_CHARS ? raw.slice(0, PER_FILE_CHARS) + '\n…[truncated]' : raw;
      fileBlocks.push(`=== ${f.rel} ===\n${body}`);
    } catch {
      /* ignore unreadable file */
    }
  }

  return `REPOSITORY OVERVIEW:\n${repo}\n\nKEY SOURCE FILES (truncated):\n\n${fileBlocks.join('\n\n')}`;
}

const SYSTEM_PROMPT = `You are a senior engineer giving a newcomer a guided tour of an unfamiliar codebase. You are given repository context and the contents of the most important source files.

Your job: explain how this codebase actually works — its purpose, its architecture, and a walkthrough of the main features showing WHERE each lives and WHAT it does.

If the developer provided a description of what the program is supposed to do, treat it as ground truth and set "inferred" to false. If they did NOT, infer the purpose yourself from the code and set "inferred" to true.

Be concrete and specific to THIS code — name real files, real classes, real functions you can see in the provided sources. Do not invent files or APIs that aren't in the context. If you're unsure about an area, say what the code suggests rather than guessing wildly.

Produce a tour with these parts:
- "summary": 1-3 sentences on what the program does (the user's description if given, otherwise your inference).
- "architecture": one tight paragraph on the high-level structure — entry points, the main layers/modules, and how data/control flows between them.
- "techStack": the key languages, frameworks, and notable libraries actually used.
- "stops": an ORDERED list of 5-9 tour stops, each covering one meaningful feature or subsystem. Order them so a newcomer can follow the flow (start at the entry point, then the core features). For each stop:
  - "title": the feature/subsystem name.
  - "file": the single most relevant workspace-relative file path (must be a real path from the context).
  - "symbol": the name of the single most important function, class, method, or exported identifier in "file" for this stop — copied EXACTLY as it appears in the code (e.g. "reviewPrompt", "class SessionStore", "generateTour"). This is used to jump to and highlight that code, so it must be a real identifier visible in the provided file contents. Use a bare name, no parentheses. If nothing specific fits, use "".
  - "relatedFiles": 0-4 other real, relevant file paths.
  - "what": plain-language explanation of what this area does and why it exists.
  - "how": how it works — the key functions/classes involved and the flow between them.

Reply with ONLY a valid JSON object, no markdown fences:
{"summary":"string","inferred":boolean,"architecture":"string","techStack":["string"],"stops":[{"title":"string","file":"string","symbol":"string","relatedFiles":["string"],"what":"string","how":"string"}]}`;

export class CodebaseTourGenerator {
  async generateTour(description?: string): Promise<CodebaseTour> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      throw new Error('No workspace folder is open. Open a project folder to tour it.');
    }
    const root = folders[0].uri.fsPath;

    const context = await gatherTourContext(root);
    const intent = description?.trim()
      ? `The developer says the program is supposed to do this:\n"${description.trim()}"\nUse this as ground truth (set "inferred" to false).`
      : `The developer did NOT describe the program. Infer its purpose from the code (set "inferred" to true).`;

    const userContent = `${intent}\n\n${context}`;
    const ai = AIProvider.getInstance();
    const resultText = await ai.generateContent(userContent, SYSTEM_PROMPT, { maxTokens: 6000 });

    try {
      const cleaned = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned) as CodebaseTour;
      if (!Array.isArray(parsed.stops)) parsed.stops = [];
      if (!Array.isArray(parsed.techStack)) parsed.techStack = [];
      for (const stop of parsed.stops) {
        if (!Array.isArray(stop.relatedFiles)) stop.relatedFiles = [];
        if (typeof stop.symbol !== 'string') stop.symbol = '';
      }
      return parsed;
    } catch {
      throw new Error('Failed to parse the codebase tour from the AI response.');
    }
  }
}
