import * as vscode from 'vscode';

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
}
