import * as vscode from 'vscode';

let channel: vscode.OutputChannel | undefined;

function getChannel(): vscode.OutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel('Detonate');
  }
  return channel;
}

function timestamp(): string {
  return new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
}

export const logger = {
  info(msg: string, ...args: unknown[]): void {
    getChannel().appendLine(`[${timestamp()}] INFO  ${msg} ${args.length ? JSON.stringify(args) : ''}`);
  },
  warn(msg: string, ...args: unknown[]): void {
    getChannel().appendLine(`[${timestamp()}] WARN  ${msg} ${args.length ? JSON.stringify(args) : ''}`);
    console.warn(`[Detonate] ${msg}`, ...args);
  },
  error(msg: string, err?: unknown): void {
    const errStr = err instanceof Error ? `\n  ${err.message}\n  ${err.stack}` : (err ? String(err) : '');
    getChannel().appendLine(`[${timestamp()}] ERROR ${msg}${errStr}`);
    console.error(`[Detonate] ${msg}`, err);
  },
  show(): void {
    getChannel().show(true);
  },
  dispose(): void {
    channel?.dispose();
    channel = undefined;
  },
};
