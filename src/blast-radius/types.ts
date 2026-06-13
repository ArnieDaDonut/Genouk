import * as vscode from 'vscode';

/** A single node in the call/reference graph */
export interface BlastNode {
  /** The symbol name (function/class/variable) */
  symbol: string;
  /** Source file URI */
  uri: vscode.Uri;
  /** Location range inside the file */
  range: vscode.Range;
  /** 0 = the selected root, 1 = direct callers, 2 = indirect callers, … */
  depth: number;
  /** Nodes that reference this node */
  callers: BlastNode[];
  /** AI one-liner describing what this symbol does (lazily fetched) */
  explanation?: string;
  /** Fetch state — guards against duplicate API calls for the same node */
  explanationState?: 'pending' | 'done' | 'error';
}

/** Full result of a blast radius analysis */
export interface AnalysisResult {
  /** The root symbol that was analysed */
  root: BlastNode;
  /** All nodes flattened (root + all transitive callers) */
  allNodes: BlastNode[];
  /** Unique files affected */
  affectedFiles: vscode.Uri[];
  /** Deepest depth reached */
  maxDepth: number;
}

/** Severity colours used by the overlay decorator */
export type BlastSeverity = 'direct' | 'indirect' | 'deep';

export function depthToSeverity(depth: number): BlastSeverity {
  if (depth === 1) return 'direct';
  if (depth === 2) return 'indirect';
  return 'deep';
}
