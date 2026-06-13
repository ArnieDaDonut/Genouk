import * as vscode from 'vscode';

export function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/**
 * HTML for the popout Planner window. Loads the same bundle as the sidebar but
 * sets `window.GENOUK_VIEW = 'planner'` so the React entry renders the roomy
 * planner layout instead of the sidebar app. No pet/audio assets here — the
 * popout is a focused, functional surface.
 */
export function plannerHtml(webview: vscode.Webview, scriptUri: vscode.Uri): string {
  const nonce = getNonce();
  return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource} https:;">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Genouk Planner</title>
    </head>
    <body>
      <div id="root"></div>
      <script nonce="${nonce}">
        window.GENOUK_VIEW = 'planner';
        const vscode = acquireVsCodeApi();
        window.acquireVsCodeApi = () => vscode;
      </script>
      <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
}
