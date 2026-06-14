import * as vscode from 'vscode';
import { PromptReviewer } from './PromptReviewer';
import { CodebaseTourGenerator } from './CodebaseTour';
import { SessionStore } from './SessionStore';
import { PlannerPanel } from './PlannerPanel';
import { handleLinearSync } from './LinearService';
import { getNonce } from './webviewHtml';
import { getSecret } from './secrets';
import { log } from './log';
import { TourNavigator } from './sidebar/TourNavigator';
import { MemoryService } from './sidebar/MemoryService';
import { VibeMonitor } from './sidebar/VibeMonitor';
import { AgentActivityMonitor } from './sidebar/AgentActivityMonitor';

export class GenoukSidebarProvider implements vscode.WebviewViewProvider {
  _view?: vscode.WebviewView;
  private readonly _extensionUri: vscode.Uri;

  private readonly promptReviewer = new PromptReviewer();
  private readonly tourGenerator = new CodebaseTourGenerator();

  /** Send a message to the webview if it's currently resolved. */
  private readonly post = (msg: unknown) => this._view?.webview.postMessage(msg);

  /** Fire the webview's synthesized notification chime (used by the test command). */
  public playNotificationChime(): void {
    this.post({ type: 'playSFX', value: 'notification' });
  }

  private readonly tour: TourNavigator;
  private readonly memory: MemoryService;
  private readonly vibe: VibeMonitor;

  constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly _store: SessionStore,
  ) {
    this._extensionUri = _context.extensionUri;

    this.tour = new TourNavigator(_context, this.post);
    this.memory = new MemoryService(this._extensionUri);
    this.vibe = new VibeMonitor(this._extensionUri, _context, this.post);
    // Self-registers its own disposables on _context; no instance handle needed.
    new AgentActivityMonitor(_context, this.post);

    // Keep the sidebar in sync when the popout planner edits the plan.
    this._context.subscriptions.push(
      this._store.onDidChange((plan) => this.post({ type: 'sessionPlan', value: plan })),
    );

    // Connect cross-chat memory out of the box: without .mcp.json the agent never
    // loads the recall/save tools, so memory silently does nothing.
    this.memory.ensureConfig();
  }

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    const audioUris = this.vibe.audioUris(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'getAudioUris': {
          this.post({ type: 'audioUris', value: audioUris });
          this.vibe.updateScore();
          break;
        }
        case 'reviewPrompt': {
          if (!data.value) return;
          const prompt = data.value as string;
          try {
            // Gather repo context once, then run both phases in parallel.
            // Phase 1 (assess) is small and lands first → the score + critique
            // show almost immediately. Phase 2 (rewrite) is the heavy call and
            // patches in once it finishes, so the user is never blocked on it.
            const repoContext = await this.promptReviewer.repoContext();

            const rewritePromise = this.promptReviewer
              .rewritePrompt(prompt, repoContext)
              .then((rewrite) => {
                this.post({ type: 'promptRewriteResult', value: rewrite });
              })
              .catch((error: any) => {
                this.post({ type: 'promptRewriteResult', value: { improvedPrompt: '', suggestions: [], error: error.message } });
              });

            const assessment = await this.promptReviewer.assessPrompt(prompt, repoContext);
            this.post({ type: 'promptReviewResult', value: assessment });

            await rewritePromise;
          } catch (error: any) {
            this.post({ type: 'error', value: error.message });
          }
          break;
        }
        case 'getSessionPlan': {
          this.post({ type: 'sessionPlan', value: this._store.get() });
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
            this.post({ type: 'error', value: error.message });
          }
          break;
        }
        case 'extendSessionPlan': {
          if (!data.value) return;
          try {
            await this._store.extend(data.value);
          } catch (error: any) {
            this.post({ type: 'error', value: error.message });
          } finally {
            this.post({ type: 'extendSessionPlanDone' });
          }
          break;
        }
        case 'syncToLinear': {
          await handleLinearSync(this._store, webviewView.webview);
          break;
        }
        case 'copyText': {
          if (typeof data.value === 'string') {
            await vscode.env.clipboard.writeText(data.value);
            vscode.window.showInformationMessage(data.label ? `${data.label} copied to clipboard.` : 'Copied to clipboard.');
          }
          break;
        }
        case 'openPlanner': {
          PlannerPanel.createOrShow(this._extensionUri, this._store);
          break;
        }
        case 'getTour': {
          this.post({ type: 'tourResult', value: this._context.workspaceState.get('codebaseTour') ?? null });
          break;
        }
        case 'generateTour': {
          try {
            const tour = await this.tourGenerator.generateTour(data.value);
            await this._context.workspaceState.update('codebaseTour', tour);
            this.post({ type: 'tourResult', value: tour });
          } catch (error: any) {
            this.post({ type: 'error', value: error.message });
          }
          break;
        }
        case 'openFile': {
          await this.tour.openFile(data.value);
          break;
        }
        case 'revealInFile': {
          await this.tour.revealInFile(data.value?.file, data.value?.symbol);
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
        case 'setTourPlaying': {
          await this.tour.setPlaying(!!data.value);
          break;
        }
        case 'getMemory': {
          this.post({ type: 'memoryData', value: this.memory.getMemoryData() });
          break;
        }
        case 'writeMcpConfig': {
          this.memory.writeConfig();
          this.post({ type: 'memoryData', value: this.memory.getMemoryData() });
          break;
        }
        case 'copyMcpConfig': {
          await this.memory.copyConfig();
          break;
        }
        case 'deleteDigest': {
          this.memory.deleteDigest(data.value);
          this.post({ type: 'memoryData', value: this.memory.getMemoryData() });
          break;
        }
        case 'clearMemory': {
          this.memory.clearAll();
          this.post({ type: 'memoryData', value: this.memory.getMemoryData() });
          break;
        }
      }
    });
  }

  public nextTourStop() {
    this.tour.next();
  }

  public previousTourStop() {
    this.tour.previous();
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'genoukApp.js')
    );

    const walkSpriteUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'public', 'genouk-walk.png'));
    const waveSpriteUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'public', 'genouk-wave.png'));
    const tourSpriteUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'public', 'genouk-point_in_tour.png'));
    const danceSpriteUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'public', 'genouk-dance.png'));
    // Base URI for the bundled instrument samples (trumpet, strings, etc.) that the
    // music engine loads via Tone.Sampler. Trailing slash so it can be used as a baseUrl.
    const samplesUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'public', 'samples'));
    // Base URI for cosmetic cut-outs; the webview appends `/<file>.png` per accessory.
    const accessoryBaseUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'public', 'accessories'));

    const nonce = getNonce();

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; media-src ${webview.cspSource} https:; connect-src ${webview.cspSource}; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource} https:;">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Genouk Assistant</title>
      </head>
      <body>
        <div id="root"></div>
        <script nonce="${nonce}">
          window.PET_WALK_SPRITE = "${walkSpriteUri}";
          window.PET_WAVE_SPRITE = "${waveSpriteUri}";
          window.PET_TOUR_SPRITE = "${tourSpriteUri}";
          window.PET_DANCE_SPRITE = "${danceSpriteUri}";
          window.GENOUK_SAMPLES = "${samplesUri}/";
          window.ACCESSORY_BASE = "${accessoryBaseUri}";

          const vscode = acquireVsCodeApi();
          window.acquireVsCodeApi = () => vscode;
        </script>
        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>`;
  }
}
