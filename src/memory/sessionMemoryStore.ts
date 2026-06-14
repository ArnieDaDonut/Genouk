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
  /**
   * Open threads from EARLIER sessions that this session closed out. Recorded so the
   * cross-session "still open" rollup stops resurfacing work that's already done.
   */
  resolvedThreads?: string[];
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
  /** Texts of prior-session open threads this session resolved (matched case-insensitively). */
  resolvedThreads?: string[];
}

const clean = (xs?: string[]): string[] => (xs || []).map((s) => s.trim()).filter(Boolean);

function writeAll(repoPath: string, all: SessionDigest[]): void {
  fs.mkdirSync(memoryDir(), { recursive: true });
  fs.writeFileSync(digestFile(repoPath), JSON.stringify(all, null, 2), 'utf8');
}

/** Append a new digest for a repo and return the stored record. */
export function saveDigest(repoPath: string, input: SaveInput): SessionDigest {
  const digest: SessionDigest = {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    title: (input.title || 'Untitled session').trim(),
    summary: (input.summary || '').trim(),
    decisions: clean(input.decisions),
    files: clean(input.files),
    openThreads: clean(input.openThreads),
    resolvedThreads: clean(input.resolvedThreads),
  };

  const all = loadDigests(repoPath);
  all.unshift(digest);
  writeAll(repoPath, all);
  return digest;
}

export interface UpdateInput {
  title?: string;
  summary?: string;
  decisions?: string[];
  files?: string[];
  openThreads?: string[];
  resolvedThreads?: string[];
}

/**
 * Amend the most recent digest in place instead of spawning a new one. Array fields are
 * MERGED (deduped), so an agent can append decisions/files/threads as a session progresses
 * without piling up near-duplicate digests. Returns the updated record, or null if there's
 * nothing to amend yet.
 */
export function updateLatestDigest(repoPath: string, patch: UpdateInput): SessionDigest | null {
  const all = loadDigests(repoPath);
  if (all.length === 0) return null;

  const latest = all[0];
  const mergeUnique = (prev: string[], next?: string[]) =>
    Array.from(new Set([...prev, ...clean(next)]));

  const updated: SessionDigest = {
    ...latest,
    ts: new Date().toISOString(),
    title: patch.title?.trim() || latest.title,
    summary: patch.summary?.trim() || latest.summary,
    decisions: mergeUnique(latest.decisions, patch.decisions),
    files: mergeUnique(latest.files, patch.files),
    openThreads: mergeUnique(latest.openThreads, patch.openThreads),
    resolvedThreads: mergeUnique(latest.resolvedThreads || [], patch.resolvedThreads),
  };

  all[0] = updated;
  writeAll(repoPath, all);
  return updated;
}

/**
 * The threads still open across ALL of a repo's sessions, newest first and deduped, with
 * anything later marked resolved removed. This is the heart of carry-over: instead of
 * re-reading every digest, a new chat sees exactly what's still pending.
 */
export function aggregateOpenThreads(repoPath: string): string[] {
  const all = loadDigests(repoPath); // newest first
  const resolved = new Set<string>();
  for (const d of all) for (const r of d.resolvedThreads || []) resolved.add(r.toLowerCase());

  const seen = new Set<string>();
  const open: string[] = [];
  for (const d of all) {
    for (const thread of d.openThreads) {
      const key = thread.toLowerCase();
      if (resolved.has(key) || seen.has(key)) continue;
      seen.add(key);
      open.push(thread);
    }
  }
  return open;
}

/**
 * Render the full carry-over briefing as plain Markdown — facts, where the last session left
 * off, threads still open across every past session, and the most recent digests in detail.
 *
 * This is the text-file path to cross-chat memory: instead of relying on an agent to call an
 * MCP tool at the start of a chat, the extension drops this Markdown into a spot the agent
 * auto-loads (a managed block in the repo's CLAUDE.md), so carry-over happens with zero tool
 * calls and can't be skipped. Pure string-building, no `vscode` and no disk writes here.
 */
export function renderCarryover(repoPath: string, limit = 5): string {
  const facts = loadFacts(repoPath);
  const all = loadDigests(repoPath); // newest first

  const lines: string[] = ['## ⏳ Cross-chat memory — carried over from past chats', ''];
  lines.push('_Genouk keeps this section in sync from past Genouk chat digests — don\'t edit it by hand._', '');

  if (facts.length) {
    lines.push('**📌 Remembered facts:**', ...facts.map((f) => `- ${f.text}`), '');
  }

  if (all.length === 0) {
    lines.push('No past sessions recorded yet. When you finish a chunk of work, call `save_context` (genouk-memory MCP) so the next chat starts here.');
    return lines.join('\n');
  }

  const last = all[0];
  lines.push(`**Last session:** ${last.title} (${new Date(last.ts).toLocaleString()})`);

  const open = aggregateOpenThreads(repoPath);
  if (open.length) {
    lines.push('', `**Still open across past sessions (${open.length}) — start here:**`, ...open.map((x) => `- ${x}`));
  } else {
    lines.push('', '**✅ No open threads carried over** — past sessions closed cleanly.');
  }

  const recent = recentDigests(repoPath, limit);
  lines.push('', `### Recent sessions (${recent.length})`, '');
  for (const d of recent) {
    lines.push(`#### ${d.title}`, `_${new Date(d.ts).toLocaleString()}_`, '', d.summary);
    if (d.decisions.length) lines.push('', '**Decisions:**', ...d.decisions.map((x) => `- ${x}`));
    if (d.files.length) lines.push('', '**Files touched:**', ...d.files.map((x) => `- ${x}`));
    if (d.openThreads.length) lines.push('', '**Open threads:**', ...d.openThreads.map((x) => `- ${x}`));
    lines.push('');
  }

  lines.push('> When you finish a meaningful chunk of work, call `save_context` (genouk-memory MCP) so the next chat carries it forward.');
  return lines.join('\n');
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

/* ------------------------------------------------------------------------- *
 * Durable facts
 *
 * Digests summarize *work*. Facts are the other half of memory: a flat list of
 * things the user explicitly asked to be remembered — a name, a secret word, a
 * URL, a preference — that should surface at the top of EVERY future chat,
 * independent of any session. Stored in a sibling file so the digest format
 * stays untouched.
 * ------------------------------------------------------------------------- */

export interface Fact {
  id: string;
  ts: string;
  /** The thing to remember, verbatim, e.g. "The secret word is BANANA". */
  text: string;
}

function factsFile(repoPath: string): string {
  return path.join(memoryDir(), `${repoKey(repoPath)}.facts.json`);
}

/** All durable facts for a repo, newest first. */
export function loadFacts(repoPath: string): Fact[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(factsFile(repoPath), 'utf8'));
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));
  } catch {
    return [];
  }
}

/**
 * Remember a fact. If an identical fact (case-insensitive) already exists its
 * timestamp is refreshed instead of storing a duplicate. Returns the record.
 */
export function saveFact(repoPath: string, text: string): Fact {
  const clean = (text || '').trim();
  const all = loadFacts(repoPath);
  const existing = all.find((f) => f.text.toLowerCase() === clean.toLowerCase());

  let record: Fact;
  if (existing) {
    existing.ts = new Date().toISOString();
    record = existing;
  } else {
    record = { id: crypto.randomUUID(), ts: new Date().toISOString(), text: clean };
    all.unshift(record);
  }

  fs.mkdirSync(memoryDir(), { recursive: true });
  fs.writeFileSync(factsFile(repoPath), JSON.stringify(all, null, 2), 'utf8');
  return record;
}

/** Forget a single fact by id. Returns true if one was removed. */
export function deleteFact(repoPath: string, id: string): boolean {
  const all = loadFacts(repoPath);
  const next = all.filter((f) => f.id !== id);
  if (next.length === all.length) return false;
  fs.mkdirSync(memoryDir(), { recursive: true });
  fs.writeFileSync(factsFile(repoPath), JSON.stringify(next, null, 2), 'utf8');
  return true;
}

/** Forget every fact for a repo. */
export function clearFacts(repoPath: string): void {
  try {
    fs.rmSync(factsFile(repoPath), { force: true });
  } catch {
    /* nothing to remove */
  }
}
