import * as vscode from 'vscode';
import { PromptReviewer } from './PromptReviewer';
import { ChangeReviewer } from './ChangeReviewer';
import { CodebaseTourGenerator } from './CodebaseTour';
import { SessionStore } from './SessionStore';
import { PlannerPanel } from './PlannerPanel';
import { getNonce } from './webviewHtml';
import { log } from './log';

export class JarvisSidebarProvider implements vscode.WebviewViewProvider {
  _view?: vscode.WebviewView;
  private promptReviewer = new PromptReviewer();
  private changeReviewer = new ChangeReviewer();
  private tourGenerator = new CodebaseTourGenerator();
  private _extensionUri: vscode.Uri;

  // Spotlight used by the live tour to highlight a symbol; cleared on a timer.
  // Deliberately bold: whole-line warm wash, a thick accent bar in the gutter,
  // and a full-height marker on the overview ruler so it's impossible to miss.
  private readonly tourHighlight = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: 'rgba(255, 184, 0, 0.20)',
    borderWidth: '0 0 0 4px',
    borderStyle: 'solid',
    borderColor: new vscode.ThemeColor('focusBorder'),
    overviewRulerColor: 'rgba(255, 184, 0, 0.9)',
    overviewRulerLane: vscode.OverviewRulerLane.Full,
  });
  private highlightClearTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly _store: SessionStore,
  ) {
    this._extensionUri = _context.extensionUri;
    this._context.subscriptions.push(this.tourHighlight);

    // Listeners for audio vibe events and compiler score updates
    this._context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.updateDiagnosticsScore()),
      vscode.workspace.onDidSaveTextDocument(() => this.handleFileSave()),
      vscode.tasks.onDidEndTaskProcess((e) => this.handleTaskEnd(e)),
      vscode.languages.onDidChangeDiagnostics((e) => {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && e.uris.some(uri => uri.toString() === activeEditor.document.uri.toString())) {
          this.updateDiagnosticsScore();
        }
      }),
      // Keep the sidebar in sync when the popout planner edits the plan.
      this._store.onDidChange((plan) => {
        this._view?.webview.postMessage({ type: 'sessionPlan', value: plan });
      })
    );

    // Most people build from the integrated terminal, not VS Code "tasks", so the
    // task event above never fires for them. Shell-integration (VS Code ≥ 1.93)
    // tells us when a terminal command finishes and its exit code — the reliable
    // signal for "good/bad compile". Guarded so older VS Code still loads.
    const onShellEnd = (vscode.window as any).onDidEndTerminalShellExecution;
    if (typeof onShellEnd === 'function') {
      this._context.subscriptions.push(
        onShellEnd((e: any) => this.handleShellEnd(e)),
      );
    }

    // The Run/Debug (F5) button doesn't use the terminal — catch it separately.
    this._context.subscriptions.push(
      vscode.debug.onDidTerminateDebugSession(() => this.handleDebugEnd()),
    );
  }

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    const audioUris = this._getAudioUris(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'getAudioUris': {
          webviewView.webview.postMessage({ type: 'audioUris', value: audioUris });
          this.updateDiagnosticsScore();
          break;
        }
        case 'reviewPrompt': {
          if (!data.value) return;
          try {
            const review = await this.promptReviewer.reviewPrompt(data.value);
            webviewView.webview.postMessage({ type: 'promptReviewResult', value: review });
          } catch (error: any) {
            webviewView.webview.postMessage({ type: 'error', value: error.message });
          }
          break;
        }
        case 'reviewChanges': {
          try {
            const review = await this.changeReviewer.reviewChanges();
            webviewView.webview.postMessage({ type: 'changeReviewResult', value: review });
          } catch (error: any) {
            webviewView.webview.postMessage({ type: 'error', value: error.message });
          }
          break;
        }
        case 'getSessionPlan': {
          webviewView.webview.postMessage({ type: 'sessionPlan', value: this._store.get() });
          break;
        }
        case 'saveSessionPlan': {
          await this._store.set(data.value);
          break;
        }
        case 'generateSessionPlan': {
          if (!data.value) return;
          try {
            await this._store.generate(data.value);
          } catch (error: any) {
            webviewView.webview.postMessage({ type: 'error', value: error.message });
          }
          break;
        }
        case 'openPlanner': {
          PlannerPanel.createOrShow(this._extensionUri, this._store);
          break;
        }
        case 'getTour': {
          webviewView.webview.postMessage({ type: 'tourResult', value: this._context.workspaceState.get('codebaseTour') ?? null });
          break;
        }
        case 'generateTour': {
          try {
            const tour = await this.tourGenerator.generateTour(data.value);
            await this._context.workspaceState.update('codebaseTour', tour);
            webviewView.webview.postMessage({ type: 'tourResult', value: tour });
          } catch (error: any) {
            webviewView.webview.postMessage({ type: 'error', value: error.message });
          }
          break;
        }
        case 'openFile': {
          await this.openWorkspaceFile(data.value);
          break;
        }
        case 'revealInFile': {
          await this.revealInFile(data.value?.file, data.value?.symbol);
          break;
        }
        case 'getPersonalization': {
          webviewView.webview.postMessage({ type: 'personalization', value: this._context.globalState.get('personalization') ?? null });
          break;
        }
        case 'savePersonalization': {
          await this._context.globalState.update('personalization', data.value);
          break;
        }
        case 'log': {
          log(`[webview] ${data.value}`);
          break;
        }
      }
    });
  }

  /** Open a workspace-relative file path in the editor (best-effort). */
  private async openWorkspaceFile(relPath: string) {
    if (!relPath) return;
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) return;
    try {
      const uri = vscode.Uri.joinPath(folders[0].uri, relPath);
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, { preview: true });
    } catch {
      vscode.window.showWarningMessage(`Genouk: couldn't open ${relPath}`);
    }
  }

  /**
   * Open a file and spotlight a symbol inside it: select it, scroll it to the
   * center, and paint a fading highlight. Used by the live tour to "point at"
   * the function each stop is about. Falls back to a plain text match, then to
   * just opening the file if the symbol can't be located.
   */
  private async revealInFile(relPath: string, symbol?: string) {
    if (!relPath) return;
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) return;

    let editor: vscode.TextEditor;
    let doc: vscode.TextDocument;
    try {
      const uri = vscode.Uri.joinPath(folders[0].uri, relPath);
      doc = await vscode.workspace.openTextDocument(uri);
      editor = await vscode.window.showTextDocument(doc, { preview: true });
    } catch {
      vscode.window.showWarningMessage(`Genouk: couldn't open ${relPath}`);
      return;
    }

    let range: vscode.Range | undefined;
    let how = 'none';
    const sym = symbol?.trim();
    if (sym) {
      const viaSymbols = await this.findSymbolRange(doc.uri, sym);
      if (viaSymbols) { range = viaSymbols; how = 'symbol-provider'; }
      else {
        const viaText = this.findTextRange(doc, sym);
        if (viaText) { range = viaText; how = 'text-search'; }
      }
    }

    if (range) {
      const line = range.start.line;
      const lineRange = new vscode.Range(line, 0, range.end.line, doc.lineAt(range.end.line).text.length);
      editor.selection = new vscode.Selection(range.start, range.end);
      editor.revealRange(lineRange, vscode.TextEditorRevealType.InCenter);
      editor.setDecorations(this.tourHighlight, [lineRange]);
      if (this.highlightClearTimer) clearTimeout(this.highlightClearTimer);
      this.highlightClearTimer = setTimeout(() => editor.setDecorations(this.tourHighlight, []), 7000);
      log(`Reveal: ${relPath} → "${sym}" via ${how} at line ${line + 1}.`);
    } else {
      editor.revealRange(new vscode.Range(0, 0, 0, 0), vscode.TextEditorRevealType.AtTop);
      log(`Reveal: ${relPath} → symbol "${sym ?? ''}" NOT found; opened at top.`);
    }
  }

  /**
   * Ask the language server for the symbol's location (most accurate). Retries a
   * couple of times because the provider is often not ready the instant a file is
   * first opened (language server warm-up).
   */
  private async findSymbolRange(uri: vscode.Uri, name: string): Promise<vscode.Range | undefined> {
    const needle = name.replace(/^(class|function|const|interface|enum|type)\s+/i, '').toLowerCase();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
          'vscode.executeDocumentSymbolProvider', uri,
        );
        if (symbols && symbols.length > 0) {
          const found = this.searchSymbols(symbols, needle);
          if (found) return found.selectionRange ?? found.range;
          return undefined; // provider ready but no match — text search will handle it
        }
      } catch {
        /* retry */
      }
      await new Promise((r) => setTimeout(r, 350));
    }
    return undefined;
  }

  private searchSymbols(symbols: vscode.DocumentSymbol[], needle: string): vscode.DocumentSymbol | undefined {
    // Prefer an exact name match anywhere in the tree, else a contains-match.
    let contains: vscode.DocumentSymbol | undefined;
    const visit = (list: vscode.DocumentSymbol[]): vscode.DocumentSymbol | undefined => {
      for (const s of list) {
        const n = s.name.toLowerCase();
        if (n === needle) return s;
        if (!contains && n.includes(needle)) contains = s;
        if (s.children?.length) {
          const hit = visit(s.children);
          if (hit) return hit;
        }
      }
      return undefined;
    };
    return visit(symbols) ?? contains;
  }

  /** Last-resort: find the literal identifier text in the document. */
  private findTextRange(doc: vscode.TextDocument, name: string): vscode.Range | undefined {
    const bare = name.replace(/^(class|function|const|interface|enum|type)\s+/i, '').trim();
    const text = doc.getText();
    const idx = text.search(new RegExp(`\\b${bare.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`));
    if (idx < 0) return undefined;
    return new vscode.Range(doc.positionAt(idx), doc.positionAt(idx + bare.length));
  }

  private updateDiagnosticsScore() {
    if (!this._view) return;

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this._view.webview.postMessage({
        type: 'updateVibe',
        value: {
          score: null,
          vibe: 'idle',
          errorsCount: 0,
          warningsCount: 0,
          fileName: ''
        }
      });
      return;
    }

    const uri = editor.document.uri;
    const diagnostics = vscode.languages.getDiagnostics(uri);

    let errorsCount = 0;
    let warningsCount = 0;

    for (const d of diagnostics) {
      if (d.severity === vscode.DiagnosticSeverity.Error) {
        errorsCount++;
      } else if (d.severity === vscode.DiagnosticSeverity.Warning) {
        warningsCount++;
      }
    }

    let score = 100 - (errorsCount * 15) - (warningsCount * 5);
    score = Math.max(0, Math.min(100, score));

    let vibe = 'fire';
    if (score < 40) {
      vibe = 'chaos';
    } else if (score < 60) {
      vibe = 'worried';
    } else if (score < 80) {
      vibe = 'chill';
    }

    this._view.webview.postMessage({
      type: 'updateVibe',
      value: {
        score,
        vibe,
        errorsCount,
        warningsCount,
        fileName: vscode.workspace.asRelativePath(uri)
      }
    });
  }

  private handleFileSave() {
    if (!this._view) return;
    this._view.webview.postMessage({ type: 'playSFX', value: 'compile' });
  }

  private handleTaskEnd(e: vscode.TaskProcessEndEvent) {
    if (!this._view) return;
    const taskName = e.execution.task.name.toLowerCase();
    const isBuild = taskName.includes('build') || taskName.includes('compile') || taskName.includes('watch') || taskName.includes('bundle');
    if (isBuild) {
      this._view.webview.postMessage({ type: 'playSFX', value: e.exitCode === 0 ? 'compile-success' : 'compile-error' });
    } else {
      // Any other task finishing is an "agent needs attention" moment.
      this._view.webview.postMessage({ type: 'playSFX', value: 'notification' });
    }
  }

  // Commands worth a sound: building OR running code. Trivial shell noise
  // (cd/ls/git/echo…) deliberately doesn't match.
  private static readonly RUN_CMD_RE =
    /\b(tsc|build|compile|bundle|webpack|vite|esbuild|rollup|make|cmake|mvn|gradle)\b/i;
  private static readonly RUN_PROG_RE =
    /\b(node|nodemon|ts-node|tsx|deno|bun|python3?|py|ruby|rails|java|dotnet|cargo|go|php|pytest|jest|vitest|mocha)\b|npm\s+(run\s+\S+|start|test|build)|yarn\s+\S+|pnpm\s+\S+/i;

  /** Terminal command finished (shell integration) — sound build/run successes/failures. */
  private handleShellEnd(e: any) {
    if (!this._view) return;
    const cmd: string = e?.execution?.commandLine?.value ?? '';
    if (!cmd) return;
    log(`Shell command finished (exit ${e.exitCode}): ${cmd}`);
    const relevant = JarvisSidebarProvider.RUN_CMD_RE.test(cmd) || JarvisSidebarProvider.RUN_PROG_RE.test(cmd);
    if (!relevant) return;
    // exitCode can be undefined if the shell couldn't report it; treat that as success.
    const failed = typeof e.exitCode === 'number' && e.exitCode !== 0;
    this._view.webview.postMessage({ type: 'playSFX', value: failed ? 'compile-error' : 'compile-success' });
  }

  /**
   * The Run/Debug (F5) button launches a debug session, which never touches the
   * terminal — so we listen for it ending. The debug API doesn't reliably expose
   * an exit code, so this just plays the "good" cue to mark "your run finished".
   */
  private handleDebugEnd() {
    if (!this._view) return;
    log('Debug session ended.');
    this._view.webview.postMessage({ type: 'playSFX', value: 'compile-success' });
  }

  private _getAudioUris(webview: vscode.Webview) {
    const filenames = [
      'vibe-idle.mp3',
      'vibe-fire.mp3',
      'vibe-chill.mp3',
      'vibe-worried.mp3',
      'vibe-chaos.mp3',
      'vibe-compile.mp3',
      'compile-success.mp3',
      'compile-error.mp3'
    ];

    const uris: Record<string, string> = {};
    for (const filename of filenames) {
      const key = filename.replace('.mp3', '');
      const uri = webview.asWebviewUri(
        vscode.Uri.joinPath(this._extensionUri, 'media', 'sounds', filename)
      );
      uris[key] = uri.toString();
    }
    return uris;
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'jarvisApp.js')
    );

    const petUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'public', '3b1b06c4-6aee-4ec5-bbd3-a82cd6693ca8.png'));
    const videoUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'public', 'no_just_make_a_video_of_the_ro.mp4'));
    const walkSpriteUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'public', 'genouk-walk.png'));
    const waveSpriteUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'public', 'genouk-wave.png'));

    const nonce = getNonce();

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; media-src ${webview.cspSource} https:; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource} https:;">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Jarvis Assistant</title>
      </head>
      <body>
        <div id="root"></div>
        <script nonce="${nonce}">
          window.PET_IMAGES = [
            "${petUri}"
          ];
          window.PET_VIDEO = "${videoUri}";
          window.PET_WALK_SPRITE = "${walkSpriteUri}";
          window.PET_WAVE_SPRITE = "${waveSpriteUri}";

          const vscode = acquireVsCodeApi();
          window.acquireVsCodeApi = () => vscode;
        </script>
        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>`;
  }
}
