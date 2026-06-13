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

/** Rough token estimate: words * 1.3 (matches the reviewer's own heuristic). */
export function estimateTokens(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.round(words * 1.3);
}
