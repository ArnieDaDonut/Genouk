import * as vscode from 'vscode';
import { SessionStore } from './SessionStore';
import { plannerHtml } from './webviewHtml';

/**
 * The popout Planner. A singleton WebviewPanel opened beside the editor (and
 * draggable to its own OS window via "Move into New Window"). It shares the
 * SessionStore with the sidebar, so both stay in sync.
 */
export class PlannerPanel {
  private static current: PlannerPanel | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  static createOrShow(extensionUri: vscode.Uri, store: SessionStore): void {
    const column = vscode.ViewColumn.Beside;

    if (PlannerPanel.current) {
      PlannerPanel.current.panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'genouk.planner',
      'Genouk Planner',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      },
    );

    PlannerPanel.current = new PlannerPanel(panel, extensionUri, store);
  }

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    store: SessionStore,
  ) {
    const scriptUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'dist', 'jarvisApp.js'),
    );
    panel.webview.html = plannerHtml(panel.webview, scriptUri);

    // Keep the popout in sync with edits made anywhere (e.g. the sidebar).
    this.disposables.push(
      store.onDidChange((plan) => {
        panel.webview.postMessage({ type: 'sessionPlan', value: plan });
      }),
    );

    panel.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'getSessionPlan':
          panel.webview.postMessage({ type: 'sessionPlan', value: store.get() });
          break;
        case 'saveSessionPlan':
          await store.set(data.value);
          break;
        case 'generateSessionPlan':
          if (!data.value) return;
          try {
            await store.generate(data.value);
          } catch (error: any) {
            panel.webview.postMessage({ type: 'error', value: error.message });
          }
          break;
      }
    }, null, this.disposables);

    panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  private dispose(): void {
    PlannerPanel.current = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      this.disposables.pop()?.dispose();
    }
  }
}
