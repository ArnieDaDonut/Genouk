import * as vscode from 'vscode';
import { PromptReviewer } from './PromptReviewer';
import { ChangeReviewer } from './ChangeReviewer';

export class JarvisSidebarProvider implements vscode.WebviewViewProvider {
  _view?: vscode.WebviewView;
  _doc?: vscode.TextDocument;
  
  private promptReviewer = new PromptReviewer();
  private changeReviewer = new ChangeReviewer();

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
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
      }
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'jarvisApp.js')
    );

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Jarvis Assistant</title>
        <style>
          body { font-family: var(--vscode-font-family); padding: 10px; color: var(--vscode-foreground); }
          textarea { width: 100%; box-sizing: border-box; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); }
          button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 12px; cursor: pointer; margin-top: 5px; }
          button:hover { background: var(--vscode-button-hoverBackground); }
          .error { color: var(--vscode-errorForeground); }
        </style>
      </head>
      <body>
        <div id="root"></div>
        <script>
          const vscode = acquireVsCodeApi();
          window.acquireVsCodeApi = () => vscode;
        </script>
        <script src="${scriptUri}"></script>
      </body>
      </html>`;
  }
}
