import * as vscode from 'vscode';
import { log } from '../log';

/**
 * Translates editor state into the webview's "vibe": a 0-100 health score from
 * the active file's diagnostics (which drives the mascot mood + ambient music)
 * plus compile/save sound effects. Owns its own event subscriptions and the
 * bundled audio URIs.
 */
export class VibeMonitor {
  constructor(
    private readonly extensionUri: vscode.Uri,
    context: vscode.ExtensionContext,
    private readonly post: (msg: unknown) => void,
  ) {
    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.updateScore()),
      vscode.workspace.onDidSaveTextDocument(() => this.post({ type: 'playSFX', value: 'compile' })),
      vscode.tasks.onDidEndTaskProcess((e) => this.handleTaskEnd(e)),
      vscode.languages.onDidChangeDiagnostics((e) => {
        const active = vscode.window.activeTextEditor;
        if (active && e.uris.some((uri) => uri.toString() === active.document.uri.toString())) {
          this.updateScore();
        }
      }),
    );

    // Shell-integration (VS Code >= 1.93) tells us when a terminal command finishes
    // and its exit code. Guarded so older VS Code versions still load.
    const onShellEnd = (vscode.window as any).onDidEndTerminalShellExecution;
    if (typeof onShellEnd === 'function') {
      context.subscriptions.push(
        onShellEnd((e: any) => this.handleShellEnd(e)),
      );
    }

    // The Run/Debug (F5) button doesn't use the terminal — catch it separately.
    context.subscriptions.push(
      vscode.debug.onDidTerminateDebugSession(() => this.handleDebugEnd()),
    );
  }

  /** Push the current active-file health score to the webview. */
  updateScore(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.post({
        type: 'updateVibe',
        value: { score: null, vibe: 'idle', errorsCount: 0, warningsCount: 0, fileName: '' },
      });
      return;
    }

    const uri = editor.document.uri;
    const diagnostics = vscode.languages.getDiagnostics(uri);

    let errorsCount = 0;
    let warningsCount = 0;
    for (const d of diagnostics) {
      if (d.severity === vscode.DiagnosticSeverity.Error) errorsCount++;
      else if (d.severity === vscode.DiagnosticSeverity.Warning) warningsCount++;
    }

    let score = 100 - errorsCount * 15 - warningsCount * 5;
    score = Math.max(0, Math.min(100, score));

    let vibe = 'fire';
    if (score < 40) vibe = 'chaos';
    else if (score < 60) vibe = 'worried';
    else if (score < 80) vibe = 'chill';

    this.post({
      type: 'updateVibe',
      value: { score, vibe, errorsCount, warningsCount, fileName: vscode.workspace.asRelativePath(uri) },
    });
  }

  private handleTaskEnd(e: vscode.TaskProcessEndEvent): void {
    const taskName = e.execution.task.name.toLowerCase();
    if (taskName.includes('build') || taskName.includes('compile') || taskName.includes('watch') || taskName.includes('bundle')) {
      this.post({ type: 'playSFX', value: e.exitCode === 0 ? 'compile-success' : 'compile-error' });
    }
  }

  /** Map each bundled vibe/SFX sound to a webview-safe URI. */
  audioUris(webview: vscode.Webview): Record<string, string> {
    const filenames = [
      'vibe-idle.mp3',
      'vibe-fire.mp3',
      'vibe-chill.mp3',
      'vibe-worried.mp3',
      'vibe-chaos.mp3',
      'vibe-compile.mp3',
      'compile-success.mp3',
      'compile-error.mp3',
    ];

    const uris: Record<string, string> = {};
    for (const filename of filenames) {
      const key = filename.replace('.mp3', '');
      uris[key] = webview
        .asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'sounds', filename))
        .toString();
    }
    return uris;
  }

  // Commands worth a sound: building OR running code. Trivial shell noise
  // (cd/ls/git/echo…) deliberately doesn't match.
  private static readonly RUN_CMD_RE =
    /\b(tsc|build|compile|bundle|webpack|vite|esbuild|rollup|make|cmake|mvn|gradle)\b/i;
  private static readonly RUN_PROG_RE =
    /\b(node|nodemon|ts-node|tsx|deno|bun|python3?|py|ruby|rails|java|dotnet|cargo|go|php|pytest|jest|vitest|mocha)\b|npm\s+(run\s+\S+|start|test|build)|yarn\s+\S+|pnpm\s+\S+/i;

  /** Terminal command finished (shell integration) — sound build/run successes/failures. */
  private handleShellEnd(e: any) {
    const cmd: string = e?.execution?.commandLine?.value ?? '';
    if (!cmd) return;
    log(`Shell command finished (exit ${e.exitCode}): ${cmd}`);
    const relevant = VibeMonitor.RUN_CMD_RE.test(cmd) || VibeMonitor.RUN_PROG_RE.test(cmd);
    if (!relevant) return;
    // exitCode can be undefined if the shell couldn't report it; treat that as success.
    const failed = typeof e.exitCode === 'number' && e.exitCode !== 0;
    this.post({ type: 'playSFX', value: failed ? 'compile-error' : 'compile-success' });
  }

  /**
   * The Run/Debug (F5) button launches a debug session, which never touches the
   * terminal — so we listen for it ending. The debug API doesn't reliably expose
   * an exit code, so this just plays the "good" cue to mark "your run finished".
   */
  private handleDebugEnd() {
    log('Debug session ended.');
    this.post({ type: 'playSFX', value: 'compile-success' });
  }
}
