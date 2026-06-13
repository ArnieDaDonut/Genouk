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

const server = new McpServer({ name: 'genouk-memory', version: '0.0.1' });

server.registerTool(
  'recall_context',
  {
    title: 'Recall prior session context',
    description:
      'Recall what previous chat sessions in THIS project accomplished — decisions made, ' +
      'files touched, and unresolved threads. Call this at the START of a new chat so you ' +
      'continue where the last session left off instead of starting cold. Returns the most ' +
      'recent session digests, newest first.',
    inputSchema: { limit: z.number().int().positive().max(20).optional().describe('How many recent sessions to return (default 5).') },
  },
  async ({ limit }) => ({
    content: [{ type: 'text', text: formatMany(recentDigests(REPO, limit ?? 5), 'No previous session memory for this project yet.') }],
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
    },
  },
  async ({ title, summary, decisions, files, openThreads }) => {
    const saved = saveDigest(REPO, { title, summary, decisions, files, openThreads });
    return { content: [{ type: 'text', text: `Saved session "${saved.title}" (${saved.id}). Future chats can recall it with recall_context.` }] };
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
