import * as vscode from 'vscode';
import { PromptReviewer } from './PromptReviewer';
import { ChangeReviewer } from './ChangeReviewer';
import { SessionStore } from './SessionStore';
import { PlannerPanel } from './PlannerPanel';
import { LinearService } from './LinearService';
import { getNonce } from './webviewHtml';

export class GenoukSidebarProvider implements vscode.WebviewViewProvider {
  _view?: vscode.WebviewView;
  private promptReviewer = new PromptReviewer();
  private changeReviewer = new ChangeReviewer();
  private _extensionUri: vscode.Uri;

  constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly _store: SessionStore,
  ) {
    this._extensionUri = _context.extensionUri;

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
        case 'syncToLinear': {
          const config = vscode.workspace.getConfiguration('genouk');
          const apiKey = config.get<string>('linearApiKey');
          const teamId = config.get<string>('linearTeamId');
          
          if (!apiKey || !teamId) {
            vscode.window.showErrorMessage('Please configure genouk.linearApiKey and genouk.linearTeamId in settings.');
            webviewView.webview.postMessage({ type: 'syncToLinearResult', value: { success: false } });
            break;
          }

          const plan = this._store.get();
          if (!plan) break;

          try {
            const updatedPlan = await LinearService.syncPlanToLinear(plan, apiKey, teamId);
            await this._store.set(updatedPlan);
            webviewView.webview.postMessage({ type: 'syncToLinearResult', value: { success: true } });
            vscode.window.showInformationMessage('Successfully synced tasks to Linear!');
          } catch (error: any) {
            webviewView.webview.postMessage({ type: 'error', value: error.message });
            webviewView.webview.postMessage({ type: 'syncToLinearResult', value: { success: false } });
          }
          break;
        }
        case 'openPlanner': {
          PlannerPanel.createOrShow(this._extensionUri, this._store);
          break;
        }
      }
    });
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
    if (taskName.includes('build') || taskName.includes('compile') || taskName.includes('watch') || taskName.includes('bundle')) {
      if (e.exitCode === 0) {
        this._view.webview.postMessage({ type: 'playSFX', value: 'compile-success' });
      } else {
        this._view.webview.postMessage({ type: 'playSFX', value: 'compile-error' });
      }
    }
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
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'genoukApp.js')
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
        <title>Genouk Assistant</title>
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

