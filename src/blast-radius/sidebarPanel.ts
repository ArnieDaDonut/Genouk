import * as vscode from 'vscode';
import { BlastNode, AnalysisResult } from './types';
import { relativeUri } from '../shared/utils';

/** Tree item representing one blast-radius node in the sidebar */
class BlastNodeItem extends vscode.TreeItem {
  constructor(public readonly node: BlastNode) {
    super(
      node.symbol,
      node.callers.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );

    this.description = `${relativeUri(node.uri)}:${node.range.start.line + 1}`;
    this.tooltip = `${node.symbol} — ${relativeUri(node.uri)} line ${node.range.start.line + 1}`;
    this.iconPath = depthIcon(node.depth);

    // Make items clickable — jump to location
    this.command = {
      command: 'vscode.open',
      title: 'Go to caller',
      arguments: [
        node.uri,
        { selection: node.range } as vscode.TextDocumentShowOptions,
      ],
    };
  }
}

function depthIcon(depth: number): vscode.ThemeIcon {
  if (depth === 0) return new vscode.ThemeIcon('flame', new vscode.ThemeColor('errorForeground'));
  if (depth === 1) return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('errorForeground'));
  if (depth === 2) return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('editorWarning.foreground'));
  return new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('editorInfo.foreground'));
}

/** TreeDataProvider for the "Blast Radius" sidebar panel */
export class BlastRadiusSidebarPanel implements vscode.TreeDataProvider<BlastNodeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<BlastNodeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private result: AnalysisResult | null = null;

  setResult(result: AnalysisResult | null): void {
    this.result = result;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: BlastNodeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: BlastNodeItem): BlastNodeItem[] {
    if (!this.result) return [];
    if (!element) {
      // Root level — show the analysed symbol
      return [new BlastNodeItem(this.result.root)];
    }
    // Children of a node = its callers
    return element.node.callers.map((c) => new BlastNodeItem(c));
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
