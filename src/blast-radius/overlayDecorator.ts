import * as vscode from 'vscode';
import { BlastNode, depthToSeverity } from './types';

/** Decoration type for direct callers (depth 1) — bold red gutter + text highlight */
const directDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: new vscode.ThemeColor('diffEditor.insertedTextBackground'),
  borderWidth: '0 0 0 3px',
  borderStyle: 'solid',
  borderColor: new vscode.ThemeColor('errorForeground'),
  gutterIconSize: 'contain',
  overviewRulerColor: new vscode.ThemeColor('errorForeground'),
  overviewRulerLane: vscode.OverviewRulerLane.Right,
  after: {
    contentText: ' 🔴 BLAST',
    color: new vscode.ThemeColor('errorForeground'),
    fontStyle: 'italic',
    margin: '0 0 0 1em',
  },
});

/** Decoration type for indirect callers (depth 2) — orange */
const indirectDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: { id: 'diffEditor.removedTextBackground' },
  borderWidth: '0 0 0 3px',
  borderStyle: 'solid',
  borderColor: new vscode.ThemeColor('editorWarning.foreground'),
  overviewRulerColor: new vscode.ThemeColor('editorWarning.foreground'),
  overviewRulerLane: vscode.OverviewRulerLane.Right,
  after: {
    contentText: ' 🟠 affected',
    color: new vscode.ThemeColor('editorWarning.foreground'),
    fontStyle: 'italic',
    margin: '0 0 0 1em',
  },
});

/** Decoration type for deep callers (depth 3+) — yellow hint */
const deepDecoration = vscode.window.createTextEditorDecorationType({
  borderWidth: '0 0 0 2px',
  borderStyle: 'dotted',
  borderColor: new vscode.ThemeColor('editorInfo.foreground'),
  overviewRulerColor: new vscode.ThemeColor('editorInfo.foreground'),
  overviewRulerLane: vscode.OverviewRulerLane.Left,
  after: {
    contentText: ' 🟡 ripple',
    color: new vscode.ThemeColor('editorInfo.foreground'),
    fontStyle: 'italic',
    margin: '0 0 0 1em',
  },
});

/** Apply blast-radius decorations to all currently visible editors */
export function applyDecorations(nodes: BlastNode[]): void {
  // Group nodes by file URI
  const byUri = new Map<string, { direct: vscode.Range[]; indirect: vscode.Range[]; deep: vscode.Range[] }>();

  for (const node of nodes) {
    if (node.depth === 0) continue; // Don't decorate the root symbol
    const key = node.uri.toString();
    if (!byUri.has(key)) {
      byUri.set(key, { direct: [], indirect: [], deep: [] });
    }
    const entry = byUri.get(key)!;
    const severity = depthToSeverity(node.depth);
    entry[severity].push(node.range);
  }

  // Apply to all visible editors that match a URI
  for (const editor of vscode.window.visibleTextEditors) {
    const uriKey = editor.document.uri.toString();
    const entry = byUri.get(uriKey);
    if (entry) {
      editor.setDecorations(directDecoration, entry.direct);
      editor.setDecorations(indirectDecoration, entry.indirect);
      editor.setDecorations(deepDecoration, entry.deep);
    } else {
      // Clear decorations for editors not in the blast radius
      editor.setDecorations(directDecoration, []);
      editor.setDecorations(indirectDecoration, []);
      editor.setDecorations(deepDecoration, []);
    }
  }
}

/** Remove all blast-radius decorations from all visible editors */
export function clearDecorations(): void {
  for (const editor of vscode.window.visibleTextEditors) {
    editor.setDecorations(directDecoration, []);
    editor.setDecorations(indirectDecoration, []);
    editor.setDecorations(deepDecoration, []);
  }
}

/** Dispose decoration types (call on deactivate) */
export function disposeDecorations(): void {
  directDecoration.dispose();
  indirectDecoration.dispose();
  deepDecoration.dispose();
}
