import * as vscode from 'vscode';
import { BlastNode, AnalysisResult } from './types';
import { BlastGraph } from './graphEngine';
import { logger } from '../shared/logger';
import { nodeKey } from '../shared/utils';

/**
 * Uses VS Code's built-in LSP commands to build a call graph starting from
 * the symbol at `position` in `document`.
 */
export async function analyzeBlastRadius(
  document: vscode.TextDocument,
  position: vscode.Position,
  maxDepth: number
): Promise<AnalysisResult | null> {
  // ── Step 1: Resolve the symbol under the cursor ──────────────────────────
  const wordRange = document.getWordRangeAtPosition(position);
  if (!wordRange) {
    logger.warn('Blast Radius: No word/symbol found at cursor position');
    return null;
  }
  const symbol = document.getText(wordRange);
  logger.info(`Blast Radius: Analysing "${symbol}" at ${document.uri.fsPath}:${position.line}`);

  const graph = new BlastGraph();

  // Root node at depth 0
  const root: BlastNode = {
    symbol,
    uri: document.uri,
    range: wordRange,
    depth: 0,
    callers: [],
  };
  graph.addNode(root);

  // ── Step 2: BFS across LSP reference calls ───────────────────────────────
  await expandNode(root, graph, maxDepth);

  const allNodes = graph.bfs(root, maxDepth);
  const affectedFiles = [
    ...new Map(
      allNodes.filter((n) => n.depth > 0).map((n) => [n.uri.toString(), n.uri])
    ).values(),
  ];

  return {
    root,
    allNodes,
    affectedFiles,
    maxDepth: Math.max(...allNodes.map((n) => n.depth)),
  };
}

/** Recursively find callers of a node via the LSP reference provider */
async function expandNode(
  node: BlastNode,
  graph: BlastGraph,
  maxDepth: number
): Promise<void> {
  if (node.depth >= maxDepth) return;

  let locations: vscode.Location[] = [];
  try {
    // Ask the active language server for all references to this symbol
    const refs = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeReferenceProvider',
      node.uri,
      node.range.start
    );
    if (refs) locations = refs;
  } catch (err) {
    logger.warn(`Blast Radius: LSP reference lookup failed for "${node.symbol}"`, err);
    return;
  }

  for (const loc of locations) {
    // Skip self-reference (the definition site itself)
    if (
      loc.uri.toString() === node.uri.toString() &&
      loc.range.intersection(node.range)
    ) {
      continue;
    }

    if (graph.hasNode(loc.uri, loc.range)) {
      // Already in graph — add as caller link
      const existing = graph.getNode(loc.uri, loc.range)!;
      if (!node.callers.includes(existing)) {
        node.callers.push(existing);
      }
      continue;
    }

    // Try to get symbol name at this location
    const callerDoc = await openDocumentSafe(loc.uri);
    const callerSymbol = callerDoc
      ? (callerDoc.getWordRangeAtPosition(loc.range.start)
          ? callerDoc.getText(callerDoc.getWordRangeAtPosition(loc.range.start)!)
          : '(unknown)')
      : '(unknown)';

    const callerNode: BlastNode = {
      symbol: callerSymbol,
      uri: loc.uri,
      range: loc.range,
      depth: node.depth + 1,
      callers: [],
    };

    graph.addNode(callerNode);
    node.callers.push(callerNode);

    // Recurse
    await expandNode(callerNode, graph, maxDepth);
  }
}

/** Opens a document without showing it in the editor */
async function openDocumentSafe(uri: vscode.Uri): Promise<vscode.TextDocument | null> {
  try {
    return await vscode.workspace.openTextDocument(uri);
  } catch {
    return null;
  }
}

/** Unique file count excluding the root */
export function countAffectedFiles(result: AnalysisResult): number {
  return result.affectedFiles.length;
}
