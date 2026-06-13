import { BlastNode } from './types';
import { nodeKey } from '../shared/utils';
import * as vscode from 'vscode';

/**
 * Directed graph of blast-radius nodes.
 * Keys are nodeKey(uri, range) strings. Values are BlastNodes.
 */
export class BlastGraph {
  private nodes = new Map<string, BlastNode>();

  addNode(node: BlastNode): void {
    const key = nodeKey(node.uri, node.range);
    if (!this.nodes.has(key)) {
      this.nodes.set(key, node);
    }
  }

  hasNode(uri: vscode.Uri, range: vscode.Range): boolean {
    return this.nodes.has(nodeKey(uri, range));
  }

  getNode(uri: vscode.Uri, range: vscode.Range): BlastNode | undefined {
    return this.nodes.get(nodeKey(uri, range));
  }

  allNodes(): BlastNode[] {
    return Array.from(this.nodes.values());
  }

  /** BFS traversal — returns all reachable nodes up to maxDepth levels */
  bfs(root: BlastNode, maxDepth: number): BlastNode[] {
    const visited = new Set<string>();
    const queue: BlastNode[] = [root];
    const result: BlastNode[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const key = nodeKey(current.uri, current.range);
      if (visited.has(key)) continue;
      visited.add(key);
      result.push(current);

      if (current.depth < maxDepth) {
        for (const caller of current.callers) {
          const callerKey = nodeKey(caller.uri, caller.range);
          if (!visited.has(callerKey)) {
            queue.push(caller);
          }
        }
      }
    }

    return result;
  }

  clear(): void {
    this.nodes.clear();
  }
}
