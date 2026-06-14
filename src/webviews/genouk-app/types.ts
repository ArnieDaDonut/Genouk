export interface PromptReviewResult {
  isFinished: boolean;
  score: number;
  feedback: string;
  improvedPrompt: string;
  tokenIssues: string[];
  /** Optional, high-value additions the developer might consider (not applied to the rewrite). */
  suggestions?: string[];
  estimatedOriginalTokens: number;
  estimatedImprovedTokens: number;
  /** True while the heavy rewrite (phase 2) is still streaming in. */
  rewriting?: boolean;
}

export interface SessionTask {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  difficulty: 'easy' | 'medium' | 'hard';
  status: 'todo' | 'in_progress' | 'completed';
}

export interface SessionPlan {
  goal: string;
  estimatedDuration: string;
  tasks: SessionTask[];
}

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

export interface VibeState {
  score: number | null;
  vibe: string;
  errorsCount: number;
  warningsCount: number;
  fileName: string;
}

/** A stored cross-chat session digest (mirrors src/memory/sessionMemoryStore.ts). */
export interface SessionDigest {
  id: string;
  ts: string;
  title: string;
  summary: string;
  decisions: string[];
  files: string[];
  openThreads: string[];
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

/** Rough token estimate: words * 1.3 (matches the reviewer's own heuristic). */
export function estimateTokens(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.round(words * 1.3);
}