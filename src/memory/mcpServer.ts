/**
 * Genouk cross-chat memory — MCP server.
 *
 * A standalone stdio MCP server that any MCP-capable agent (Claude Code, Cursor,
 * Windsurf, …) can connect to. It gives agents three tools to carry context across
 * brand-new chats within the same repository:
 *
 *   • recall_context  — pull the most recent session digests (call at chat start)
 *   • save_context    — persist a digest of the current session (call at chat end)
 *   • search_context  — keyword-search past sessions
 *
 * Plus a `genouk://memory/recent` resource the client can attach directly.
 *
 * Which repository the memory belongs to is taken from GENOUK_REPO (set by Genouk when
 * it writes the MCP config), falling back to the process cwd. Storage lives on disk via
 * sessionMemoryStore — there is no network dependency.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  SessionDigest,
  recentDigests,
  saveDigest,
  searchDigests,
  updateLatestDigest,
  aggregateOpenThreads,
  loadDigests,
} from './sessionMemoryStore';

const REPO = process.env.GENOUK_REPO || process.cwd();

/** Render a digest as readable text for an agent to consume. */
function formatDigest(d: SessionDigest): string {
  const when = new Date(d.ts).toLocaleString();
  const lines = [`## ${d.title}`, `_${when}_`, '', d.summary];
  if (d.decisions.length) lines.push('', '**Decisions:**', ...d.decisions.map((x) => `- ${x}`));
  if (d.files.length) lines.push('', '**Files touched:**', ...d.files.map((x) => `- ${x}`));
  if (d.openThreads.length) lines.push('', '**Open threads / next steps:**', ...d.openThreads.map((x) => `- ${x}`));
  return lines.join('\n');
}

function formatMany(digests: SessionDigest[], emptyMsg: string): string {
  if (digests.length === 0) return emptyMsg;
  return digests.map(formatDigest).join('\n\n---\n\n');
}

/**
 * The full recall briefing. Leads with what's still open across every past session (so a
 * fresh chat sees pending work immediately) and where the last session left off, THEN the
 * recent digests in detail. This consolidated view is what makes carry-over actually useful.
 */
function buildRecall(limit: number): string {
  const all = loadDigests(REPO);
  if (all.length === 0) return 'No previous session memory for this project yet. This is a fresh start — call save_context before you finish so the next chat can pick up from here.';

  const recent = recentDigests(REPO, limit);
  const open = aggregateOpenThreads(REPO);
  const last = all[0];
  const when = new Date(last.ts).toLocaleString();

  const head: string[] = [
    `# Continuing this project — ${all.length} past session${all.length === 1 ? '' : 's'} on record`,
    '',
    `**Last session:** ${last.title} (${when})`,
  ];
  if (open.length) {
    head.push('', `**⏳ Still open across past sessions (${open.length}) — start here:**`, ...open.map((x) => `- ${x}`));
    head.push('', 'When you finish any of these, pass them to save_context/update_context as `resolvedThreads` so they stop resurfacing.');
  } else {
    head.push('', '**✅ No open threads carried over** — past sessions closed cleanly.');
  }

  return [head.join('\n'), '', '---', '', `## Recent session digests (${recent.length})`, '', formatMany(recent, '')].join('\n');
}

const server = new McpServer({ name: 'genouk-memory', version: '0.0.1' });

server.registerTool(
  'recall_context',
  {
    title: 'Recall prior session context',
    description:
      'Recall what previous chat sessions in THIS project accomplished — decisions made, ' +
      'files touched, and unresolved threads. Call this at the START of a new chat so you ' +
      'continue where the last session left off instead of starting cold. Leads with a ' +
      'consolidated list of threads still open across all past sessions, then the most ' +
      'recent session digests in detail.',
    inputSchema: { limit: z.number().int().positive().max(20).optional().describe('How many recent session digests to show in detail (default 5).') },
  },
  async ({ limit }) => ({
    content: [{ type: 'text', text: buildRecall(limit ?? 5) }],
  }),
);

server.registerTool(
  'save_context',
  {
    title: 'Save session context for future chats',
    description:
      'Persist a concise digest of the CURRENT session so future chats can recall it. Call ' +
      'this at the end of a session, or after finishing a meaningful chunk of work. Write the ' +
      'summary the way you would brief a teammate taking over: what changed, what was decided, ' +
      'and what is still open.',
    inputSchema: {
      title: z.string().describe('One-line title, e.g. "Built the cross-chat memory MCP server".'),
      summary: z.string().describe('A few sentences: what happened this session and why.'),
      decisions: z.array(z.string()).optional().describe('Concrete decisions made, each a short bullet.'),
      files: z.array(z.string()).optional().describe('Files created or meaningfully changed.'),
      openThreads: z.array(z.string()).optional().describe('Unresolved threads / next steps for the following session.'),
      resolvedThreads: z.array(z.string()).optional().describe('Open threads from EARLIER sessions you closed out this session. Copy their text from recall_context so they stop resurfacing.'),
    },
  },
  async ({ title, summary, decisions, files, openThreads, resolvedThreads }) => {
    const saved = saveDigest(REPO, { title, summary, decisions, files, openThreads, resolvedThreads });
    const stillOpen = aggregateOpenThreads(REPO).length;
    return { content: [{ type: 'text', text: `Saved session "${saved.title}" (${saved.id}). ${stillOpen} thread${stillOpen === 1 ? '' : 's'} still open project-wide. Future chats can recall it with recall_context.` }] };
  },
);

server.registerTool(
  'update_context',
  {
    title: 'Amend the current session digest',
    description:
      'Update the MOST RECENT session digest in place instead of creating a new one. Use this ' +
      'when you already saved a digest this session and want to append new decisions, files, or ' +
      'threads, or mark earlier threads resolved — it keeps one digest per session instead of ' +
      'piling up near-duplicates. Array fields are merged and deduped.',
    inputSchema: {
      title: z.string().optional().describe('Replace the title (optional).'),
      summary: z.string().optional().describe('Replace the summary (optional).'),
      decisions: z.array(z.string()).optional().describe('Decisions to add (merged with existing).'),
      files: z.array(z.string()).optional().describe('Files to add (merged with existing).'),
      openThreads: z.array(z.string()).optional().describe('Open threads to add (merged with existing).'),
      resolvedThreads: z.array(z.string()).optional().describe('Earlier-session threads now resolved.'),
    },
  },
  async (patch) => {
    const updated = updateLatestDigest(REPO, patch);
    if (!updated) return { content: [{ type: 'text', text: 'Nothing to update — no digest saved yet. Use save_context first.' }] };
    return { content: [{ type: 'text', text: `Updated session "${updated.title}" (${updated.id}).` }] };
  },
);

server.registerTool(
  'search_context',
  {
    title: 'Search past session memory',
    description: 'Keyword-search past chat sessions in this project for a topic, file, or decision.',
    inputSchema: {
      query: z.string().describe('Words to search for across past session digests.'),
      limit: z.number().int().positive().max(20).optional().describe('Max results (default 8).'),
    },
  },
  async ({ query, limit }) => ({
    content: [{ type: 'text', text: formatMany(searchDigests(REPO, query, limit ?? 8), `No past sessions matched "${query}".`) }],
  }),
);

server.registerResource(
  'recent-sessions',
  'genouk://memory/recent',
  {
    title: 'Recent Genouk session memory',
    description: 'The most recent cross-chat session digests for this project.',
    mimeType: 'text/markdown',
  },
  async (uri) => ({
    contents: [{ uri: uri.href, mimeType: 'text/markdown', text: formatMany(recentDigests(REPO, 8), 'No previous session memory for this project yet.') }],
  }),
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Never log to stdout — that channel is the MCP protocol. stderr is safe.
  process.stderr.write(`[genouk-memory] MCP server ready (repo: ${REPO})\n`);
}

main().catch((err) => {
  process.stderr.write(`[genouk-memory] fatal: ${err?.stack || err}\n`);
  process.exit(1);
});
