import * as vscode from 'vscode';

let channel: vscode.OutputChannel | undefined;

/** Shared "Genouk" output channel. Open it via View → Output → "Genouk". */
export function log(message: string): void {
  if (!channel) {
    channel = vscode.window.createOutputChannel('Genouk');
  }
  const ts = new Date().toLocaleTimeString();
  channel.appendLine(`[${ts}] ${message}`);
}
