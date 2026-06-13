/**
 * Cross-chat memory store. Each "digest" is a compact, AI-written summary of one agent
 * chat session — what was decided, which files were touched, and what's still open — so
 * a brand-new chat can recall where the last one left off.
 *
 * Digests are plain JSON on disk, keyed by repository so memory stays per-project:
 *
 *   ~/.genouk/sessions/<repo-hash>.json   → SessionDigest[]
 *
 * This module is deliberately free of any `vscode` import: it's shared by the extension
 * host (which renders the Memory tab and writes the MCP config) AND by the standalone
 * MCP server process (which has no access to the VS Code API). Keep it pure Node.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

export interface SessionDigest {
  /** Stable unique id (also the basis for de-duping). */
  id: string;
  /** ISO timestamp of when the session was saved. */
  ts: string;
  /** One-line title for the session, e.g. "Wired up the score-reactive music engine". */
  title: string;
  /** The narrative digest: what happened and why, in a few sentences. */
  summary: string;
  /** Concrete decisions made, each a short bullet. */
  decisions: string[];
  /** Files created or meaningfully changed during the session. */
  files: string[];
  /** Unresolved threads / next steps the following session should pick up. */
  openThreads: string[];
}

/** Root directory for all stored digests. Override with GENOUK_HOME for tests. */
export function memoryDir(): string {
  const home = process.env.GENOUK_HOME || path.join(os.homedir(), '.genouk');
  return path.join(home, 'sessions');
}

/** Stable filesystem-safe key for a repo path. */
export function repoKey(repoPath: string): string {
  const normalized = path.resolve(repoPath || '.');
  return crypto.createHash('sha1').update(normalized).digest('hex').slice(0, 16);
}

function digestFile(repoPath: string): string {
  return path.join(memoryDir(), `${repoKey(repoPath)}.json`);
}

/** Read all digests for a repo, newest first. Returns [] if nothing is stored yet. */
export function loadDigests(repoPath: string): SessionDigest[] {
  const file = digestFile(repoPath);
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));
  } catch {
    return [];
  }
}

/** The N most recent digests for a repo, newest first. */
export function recentDigests(repoPath: string, limit = 5): SessionDigest[] {
  return loadDigests(repoPath).slice(0, Math.max(0, limit));
}

export interface SaveInput {
  title: string;
  summary: string;
  decisions?: string[];
  files?: string[];
  openThreads?: string[];
}

/** Append a new digest for a repo and return the stored record. */
export function saveDigest(repoPath: string, input: SaveInput): SessionDigest {
  const digest: SessionDigest = {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    title: (input.title || 'Untitled session').trim(),
    summary: (input.summary || '').trim(),
    decisions: (input.decisions || []).map((s) => s.trim()).filter(Boolean),
    files: (input.files || []).map((s) => s.trim()).filter(Boolean),
    openThreads: (input.openThreads || []).map((s) => s.trim()).filter(Boolean),
  };

  const all = loadDigests(repoPath);
  all.unshift(digest);

  fs.mkdirSync(memoryDir(), { recursive: true });
  fs.writeFileSync(digestFile(repoPath), JSON.stringify(all, null, 2), 'utf8');
  return digest;
}

/** Keyword search across a repo's digests; ranks by number of term hits. */
export function searchDigests(repoPath: string, query: string, limit = 8): SessionDigest[] {
  const terms = (query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return recentDigests(repoPath, limit);

  const haystack = (d: SessionDigest) =>
    `${d.title} ${d.summary} ${d.decisions.join(' ')} ${d.files.join(' ')} ${d.openThreads.join(' ')}`.toLowerCase();

  return loadDigests(repoPath)
    .map((d) => ({ d, score: terms.reduce((n, term) => n + (haystack(d).includes(term) ? 1 : 0), 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (b.d.ts || '').localeCompare(a.d.ts || ''))
    .slice(0, limit)
    .map((x) => x.d);
}

/** Delete a single digest by id. Returns true if one was removed. */
export function deleteDigest(repoPath: string, id: string): boolean {
  const all = loadDigests(repoPath);
  const next = all.filter((d) => d.id !== id);
  if (next.length === all.length) return false;
  fs.mkdirSync(memoryDir(), { recursive: true });
  fs.writeFileSync(digestFile(repoPath), JSON.stringify(next, null, 2), 'utf8');
  return true;
}

/** Remove every digest for a repo. */
export function clearDigests(repoPath: string): void {
  const file = digestFile(repoPath);
  try {
    fs.rmSync(file, { force: true });
  } catch {
    /* nothing to remove */
  }
}
