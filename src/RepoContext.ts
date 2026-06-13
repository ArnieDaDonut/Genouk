import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import * as util from 'util';

const exec = util.promisify(cp.exec);

// Directories we never want to walk or report — they carry no useful intent signal
// and would blow the token budget.
const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'out', 'build', '.next', '.cache',
  'coverage', '.vscode-test', '.turbo', 'vendor', '__pycache__', '.venv',
]);

// Map common file extensions to a human language name for the "primary languages" summary.
const EXT_TO_LANG: Record<string, string> = {
  ts: 'TypeScript', tsx: 'TypeScript (React)', js: 'JavaScript', jsx: 'JavaScript (React)',
  py: 'Python', rb: 'Ruby', go: 'Go', rs: 'Rust', java: 'Java', kt: 'Kotlin',
  c: 'C', h: 'C', cpp: 'C++', cc: 'C++', cs: 'C#', php: 'PHP', swift: 'Swift',
  scala: 'Scala', sh: 'Shell', sql: 'SQL', css: 'CSS', scss: 'SCSS', html: 'HTML',
  vue: 'Vue', svelte: 'Svelte', json: 'JSON', yaml: 'YAML', yml: 'YAML', md: 'Markdown',
};

export interface RepoContextOptions {
  /** Include the active editor's content/selection. Use for prompt review. */
  includeActiveFile?: boolean;
  /** Approximate character budget for the whole context block. */
  charBudget?: number;
}

/**
 * Gathers lightweight, read-only signal about the workspace so the LLM can make
 * educated guesses about the developer's intent instead of answering in a vacuum.
 * Everything here is best-effort: any single failing probe is swallowed so the
 * reviewers still work in a non-git folder or an empty workspace.
 */
export async function gatherRepoContext(opts: RepoContextOptions = {}): Promise<string> {
  const budget = opts.charBudget ?? 6000;
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return 'No workspace folder is open; no repository context available.';
  }
  const root = folders[0].uri.fsPath;

  const sections: string[] = [];

  const pkg = readPackageSummary(root);
  if (pkg) sections.push(pkg);

  const { tree, langs } = walkTree(root, 2, 160);
  if (langs) sections.push(`Primary languages: ${langs}`);
  if (tree) sections.push(`File tree (truncated):\n${tree}`);

  const commits = await readRecentCommits(root);
  if (commits) sections.push(`Recent commits:\n${commits}`);

  if (opts.includeActiveFile) {
    const active = readActiveFile();
    if (active) sections.push(active);
  }

  let out = sections.join('\n\n');
  if (out.length > budget) {
    out = out.slice(0, budget) + '\n…[context truncated]';
  }
  return out || 'No repository context available.';
}

function readPackageSummary(root: string): string | null {
  try {
    const raw = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
    const pkg = JSON.parse(raw);
    const deps = Object.keys(pkg.dependencies ?? {});
    const devDeps = Object.keys(pkg.devDependencies ?? {});
    const lines = [`package.json: ${pkg.name ?? '(unnamed)'}${pkg.description ? ` — ${pkg.description}` : ''}`];
    if (deps.length) lines.push(`  dependencies: ${deps.slice(0, 25).join(', ')}${deps.length > 25 ? ', …' : ''}`);
    if (devDeps.length) lines.push(`  devDependencies: ${devDeps.slice(0, 15).join(', ')}${devDeps.length > 15 ? ', …' : ''}`);
    return lines.join('\n');
  } catch {
    return null;
  }
}

/**
 * Bounded breadth-first-ish walk. Returns an indented tree string plus a ranked
 * summary of the languages seen, both derived from the same single pass.
 */
function walkTree(root: string, maxDepth: number, maxEntries: number): { tree: string; langs: string } {
  const lines: string[] = [];
  const extCounts: Record<string, number> = {};
  let count = 0;

  const walk = (dir: string, depth: number, prefix: string) => {
    if (depth > maxDepth || count >= maxEntries) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    // Dirs first, then files, alphabetical — stable, readable output.
    entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of entries) {
      if (count >= maxEntries) {
        lines.push(`${prefix}…`);
        return;
      }
      if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        lines.push(`${prefix}${entry.name}/`);
        count++;
        walk(path.join(dir, entry.name), depth + 1, prefix + '  ');
      } else {
        lines.push(`${prefix}${entry.name}`);
        count++;
        const ext = entry.name.split('.').pop()?.toLowerCase();
        if (ext && EXT_TO_LANG[ext]) {
          extCounts[EXT_TO_LANG[ext]] = (extCounts[EXT_TO_LANG[ext]] ?? 0) + 1;
        }
      }
    }
  };

  walk(root, 0, '');

  // Don't let pure-config files (JSON/YAML/Markdown) dominate the language read.
  const noise = new Set(['JSON', 'YAML', 'Markdown']);
  const langs = Object.entries(extCounts)
    .sort((a, b) => b[1] - a[1])
    .filter(([lang], i) => !noise.has(lang) || i < 3)
    .slice(0, 4)
    .map(([lang]) => lang)
    .join(', ');

  return { tree: lines.join('\n'), langs };
}

async function readRecentCommits(root: string): Promise<string | null> {
  try {
    const { stdout } = await exec('git log -5 --pretty=format:"%h %s" --no-color', { cwd: root });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

function readActiveFile(): string | null {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return null;
  const doc = editor.document;
  if (doc.uri.scheme !== 'file') return null;

  const relPath = vscode.workspace.asRelativePath(doc.uri);
  const selection = editor.selection;
  const hasSelection = selection && !selection.isEmpty;

  if (hasSelection) {
    const selected = doc.getText(selection);
    return `Active file: ${relPath} (selection, lines ${selection.start.line + 1}-${selection.end.line + 1}):\n${truncate(selected, 2000)}`;
  }

  return `Active file: ${relPath} (${doc.languageId}):\n${truncate(doc.getText(), 2000)}`;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '\n…[file truncated]';
}
