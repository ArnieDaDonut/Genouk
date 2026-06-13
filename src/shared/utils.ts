import * as vscode from 'vscode';
import * as path from 'path';

/** Debounce: returns a function that delays invoking `fn` until after `ms` ms of inactivity */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Get the word at the cursor position in the given document */
export function getWordAtPosition(
  document: vscode.TextDocument,
  position: vscode.Position
): string | undefined {
  const range = document.getWordRangeAtPosition(position);
  return range ? document.getText(range) : undefined;
}

/** Get N lines of context around a given range (clamped to document bounds) */
export function getSurroundingContext(
  document: vscode.TextDocument,
  range: vscode.Range,
  lines: number = 20
): string {
  const startLine = Math.max(0, range.start.line - lines);
  const endLine = Math.min(document.lineCount - 1, range.end.line + lines);
  const contextRange = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
  return document.getText(contextRange);
}

/** Produce a short human-readable label for a URI (relative to workspace root) */
export function relativeUri(uri: vscode.Uri): string {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    const root = workspaceFolders[0].uri.fsPath;
    const rel = path.relative(root, uri.fsPath);
    return rel;
  }
  return path.basename(uri.fsPath);
}

/** Convert a vscode.Uri + Range to a unique string key for graph nodes */
export function nodeKey(uri: vscode.Uri, range: vscode.Range): string {
  return `${uri.toString()}#${range.start.line}:${range.start.character}`;
}

/** Sleep for ms milliseconds (useful in tests) */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Escape HTML special characters for safe injection into webview HTML */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Generate a random nonce string for Content-Security-Policy in webviews */
export function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
