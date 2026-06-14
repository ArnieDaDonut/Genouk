/**
 * Shared type definitions used by both the extension host and the webview.
 *
 * This is the single source of truth — both sides import from here so the
 * message-passing contract stays consistent. Do not duplicate these in
 * SessionPlanner.ts, PromptReviewer.ts, or webviews/genouk-app/types.ts.
 */

/* ------------------------------------------------------------------ *
 *  Session planner
 * ------------------------------------------------------------------ */

export interface SessionTask {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  difficulty: 'easy' | 'medium' | 'hard';
  status: 'todo' | 'in_progress' | 'completed';
  linearIssueId?: string;
  linearIssueUrl?: string;
}

export interface SessionPlan {
  goal: string;
  estimatedDuration: string;
  tasks: SessionTask[];
}

/* ------------------------------------------------------------------ *
 *  Prompt reviewer
 * ------------------------------------------------------------------ */

export interface PromptReviewResult {
  isFinished: boolean;
  score: number; // 0-100
  feedback: string;
  improvedPrompt: string;
  tokenIssues: string[]; // specific weaknesses found
  /** Optional, high-value additions the developer might consider. */
  suggestions?: string[];
  estimatedOriginalTokens: number;
  estimatedImprovedTokens: number;
  /** True while the heavy rewrite is still being generated (phase 2). */
  rewriting?: boolean;
}

/* ------------------------------------------------------------------ *
 *  Codebase tour
 * ------------------------------------------------------------------ */

export interface TourStop {
  title: string;
  file: string;
  symbol: string;
  relatedFiles: string[];
  what: string;
  how: string;
}

export interface CodebaseTour {
  summary: string;
  inferred: boolean;
  architecture: string;
  techStack: string[];
  stops: TourStop[];
}

/* ------------------------------------------------------------------ *
 *  Personalization & vibe
 * ------------------------------------------------------------------ */

export interface Personalization {
  /** Accessory id from accessories.ts (e.g. 'tophat'). */
  accessory: string;
  /** Selected SFX (SfxName from musicEngine) per event slot. */
  sfx: {
    goodCompile: string;
    badCompile: string;
    notification: string;
  };
}

export const DEFAULT_PERSONALIZATION: Personalization = {
  accessory: 'none',
  sfx: { goodCompile: 'chime', badCompile: 'buzz', notification: 'ping' },
};

export interface VibeState {
  score: number | null;
  vibe: string;
  errorsCount: number;
  warningsCount: number;
  fileName: string;
}

/* ------------------------------------------------------------------ *
 *  Utilities
 * ------------------------------------------------------------------ */

/** Rough token estimate: words * 1.3 (matches the reviewer's own heuristic). */
export function estimateTokens(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.round(words * 1.3);
}

/* ------------------------------------------------------------------ *
 *  Session memory & digests
 * ------------------------------------------------------------------ */

/** A stored cross-chat session digest (mirrors src/memory/sessionMemoryStore.ts). */
export interface SessionDigest {
  id: string;
  ts: string;
  title: string;
  summary: string;
  decisions: string[];
  files: string[];
  openThreads: string[];
  /** Earlier-session threads this session closed out (drives the "still open" rollup). */
  resolvedThreads?: string[];
}

/** Everything the Memory tab needs: stored digests + how to wire the MCP server up. */
export interface MemoryData {
  digests: SessionDigest[];
  /** Pretty-printed .mcp.json snippet the user can copy into their agent. */
  mcpConfig: string;
  /** Absolute path where Genouk writes .mcp.json (the repo root), or null if no repo. */
  mcpConfigPath: string | null;
  /** True once a genouk-memory entry exists in the repo's .mcp.json. */
  configWritten: boolean;
  /** Short label for the active repo (basename), or null if no folder is open. */
  repoLabel: string | null;
}
