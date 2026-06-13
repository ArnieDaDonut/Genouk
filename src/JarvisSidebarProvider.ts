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

    const nonce = getNonce();

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline';">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Jarvis Assistant</title>
      </head>
      <body>
        <div id="root"></div>
        <script nonce="${nonce}">
          const vscode = acquireVsCodeApi();
          window.acquireVsCodeApi = () => vscode;
        </script>
        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>`;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
