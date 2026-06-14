/**
 * Genouk cross-chat memory — auto-save Stop hook.
 *
 * Cross-chat recall is automatic (the carry-over block in CLAUDE.md is auto-loaded every
 * chat), but SAVING used to depend on the agent voluntarily calling the save_context MCP
 * tool — which it usually skips, so the "last chat" pointer never advanced. This script
 * closes that gap: Genouk registers it as a Claude Code **Stop hook**, so it runs whenever
 * the agent finishes responding and records what the current chat is about, with zero
 * reliance on the agent remembering.
 *
 * Claude Code has no "chat ended" event — Stop fires on EVERY turn — so we key the digest by
 * the chat's session_id and UPSERT it (see upsertSessionDigest). One chat → one digest that
 * keeps getting refreshed as the chat grows, instead of a new digest per turn.
 *
 * Input: the hook payload arrives as JSON on stdin
 *   { session_id, transcript_path, cwd, hook_event_name, stop_hook_active }
 * The digest is keyed per-repo by `cwd` (same per-project model as the MCP server's
 * GENOUK_REPO). Pure Node — no `vscode` — so it bundles into its own standalone process.
 *
 * Best-effort by design: any failure exits 0 with no output so a hiccup here never disrupts
 * the user's chat.
 */
import * as fs from 'fs';
import { upsertSessionDigest, syncCarryoverFile } from './sessionMemoryStore';

interface StopHookInput {
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
  hook_event_name?: string;
  stop_hook_active?: boolean;
}

/** Tool names that mean a file was created or meaningfully changed. */
const WRITE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

/** Read all of stdin as a string. */
function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
  });
}

/** Flatten a message's `content` (string or block array) into plain text blocks only. */
function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((b: any) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b: any) => b.text as string)
    .join('\n');
}

/**
 * Genuine user input only: skip tool-result turns and the harness-injected
 * <system-reminder>/<command-name>/<local-command-*> wrappers, which aren't things the
 * user actually typed and would pollute the title/summary.
 */
function isRealUserText(content: unknown): boolean {
  if (Array.isArray(content) && content.some((b: any) => b && b.type === 'tool_result')) return false;
  const t = textOf(content).trim();
  if (!t) return false;
  if (t.startsWith('<system-reminder') || t.startsWith('<command-') || t.startsWith('<local-command')) return false;
  return true;
}

/** Trim to a single line, collapse whitespace, cap length. */
function oneLine(s: string, max: number): string {
  const line = s.replace(/\s+/g, ' ').trim();
  return line.length > max ? line.slice(0, max - 1).trimEnd() + '…' : line;
}

interface Parsed {
  title: string;
  summary: string;
  files: string[];
}

/** Build a heuristic digest from the JSONL transcript: what the user asked + files changed. */
function parseTranscript(transcriptPath: string, cwd: string): Parsed | null {
  let raw: string;
  try {
    raw = fs.readFileSync(transcriptPath, 'utf8');
  } catch {
    return null;
  }

  const userTexts: string[] = [];
  const files = new Set<string>();

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let entry: any;
    try {
      entry = JSON.parse(trimmed);
    } catch {
      continue;
    }
    const msg = entry?.message;
    if (!msg) continue;

    if (entry.type === 'user' && isRealUserText(msg.content)) {
      userTexts.push(textOf(msg.content).trim());
    } else if (entry.type === 'assistant' && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block?.type !== 'tool_use' || !WRITE_TOOLS.has(block.name)) continue;
        const fp = block.input?.file_path || block.input?.notebook_path;
        if (typeof fp === 'string' && fp) {
          files.add(fp.startsWith(cwd) ? fp.slice(cwd.length).replace(/^\//, '') : fp);
        }
      }
    }
  }

  if (userTexts.length === 0) return null;

  const title = oneLine(userTexts[0], 70);
  // Summarize from the user's own requests — an honest "what this chat was about" without
  // needing a model in the hook path (which would add latency to every single turn).
  const requests = userTexts.slice(0, 4).map((t) => oneLine(t, 200));
  const summary =
    requests.length === 1
      ? `User asked: ${requests[0]}`
      : `Chat covering ${userTexts.length} user request${userTexts.length === 1 ? '' : 's'}. ` +
        requests.map((r) => `• ${r}`).join(' ');

  return { title, summary, files: [...files] };
}

async function main(): Promise<void> {
  const input: StopHookInput = JSON.parse((await readStdin()) || '{}');
  const sessionId = input.session_id;
  const repo = input.cwd || process.cwd();
  if (!sessionId || !input.transcript_path) return; // nothing to key on — skip silently

  const parsed = parseTranscript(input.transcript_path, repo);
  if (!parsed) return; // empty / unreadable transcript — don't record a blank digest

  upsertSessionDigest(repo, sessionId, {
    title: parsed.title,
    summary: parsed.summary,
    files: parsed.files,
  });
  // Refresh the auto-loaded carry-over block so the NEXT chat sees this one immediately.
  syncCarryoverFile(repo);
}

// Best-effort: never let a hook failure surface to the user's chat.
main()
  .catch(() => {})
  .finally(() => process.exit(0));
