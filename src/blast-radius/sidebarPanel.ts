import * as vscode from 'vscode';
import { BlastNode, AnalysisResult } from './types';
import { relativeUri } from '../shared/utils';

/** Lazily resolves a one-line AI explanation for a node. */
export type NodeExplainer = (node: BlastNode) => Promise<string>;

/** Trim a one-liner so it fits inline in the tree's description column. */
function truncate(text: string, max = 60): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** Tree item representing one blast-radius node in the sidebar */
class BlastNodeItem extends vscode.TreeItem {
  constructor(public readonly node: BlastNode) {
    super(
      node.symbol,
      node.callers.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );

    const loc = `${relativeUri(node.uri)}:${node.range.start.line + 1}`;

    // Always show the affected file:line (the core "what gets hit" indicator),
    // then append the AI explanation once it loads.
    const explainBit =
      node.explanationState === 'done' && node.explanation
        ? `  ·  ${truncate(node.explanation, 48)}`
        : node.explanationState === 'pending'
        ? '  ·  ⏳ explaining…'
        : node.explanationState === 'error'
        ? '  ·  ⚠️ rate-limited (retry later)'
        : '';
    this.description = `${loc}${explainBit}`;

    this.tooltip = buildTooltip(node, loc);
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

/** Rich hover tooltip combining location with the AI explanation. */
function buildTooltip(node: BlastNode, loc: string): vscode.MarkdownString {
  const md = new vscode.MarkdownString();
  md.appendMarkdown(`**${node.symbol}** — \`${loc}\`\n\n`);

  switch (node.explanationState) {
    case 'done':
      md.appendMarkdown(`🧠 ${node.explanation}`);
      break;
    case 'pending':
      md.appendMarkdown(`_⏳ Explaining what this does…_`);
      break;
    case 'error':
      md.appendMarkdown(
        `_Explanation unavailable — set \`detonate.geminiApiKey\` to enable AI explanations._`
      );
      break;
    default:
      md.appendMarkdown(`_${node.depth === 0 ? 'The symbol you are changing.' : 'Affected by your change.'}_`);
  }
  return md;
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

  /** Optional AI explainer; when absent, nodes show location only. */
  constructor(private readonly explainer?: NodeExplainer) {}

  setResult(result: AnalysisResult | null): void {
    this.result = result;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: BlastNodeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: BlastNodeItem): BlastNodeItem[] {
    if (!this.result) return [];

    const nodes = element
      ? element.node.callers // Children of a node = its callers
      : [this.result.root]; // Root level — the analysed symbol

    // Kick off explanation only for the nodes actually being rendered (i.e.
    // expanded), so we don't hit the API for collapsed branches.
    for (const node of nodes) this.maybeExplain(node);

    return nodes.map((n) => new BlastNodeItem(n));
  }

  /**
   * Fetch the AI explanation for a node exactly once. The `explanationState`
   * guard makes this idempotent across the tree refreshes we trigger on
   * completion, so there is no refetch loop.
   */
  private maybeExplain(node: BlastNode): void {
    if (!this.explainer || node.explanationState) return;

    node.explanationState = 'pending';
    this.explainer(node)
      .then((text) => {
        node.explanation = text;
        node.explanationState = 'done';
      })
      .catch(() => {
        node.explanationState = 'error';
      })
      .finally(() => this._onDidChangeTreeData.fire());
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
