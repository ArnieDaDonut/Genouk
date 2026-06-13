import * as vscode from 'vscode';

export class JarvisSidebarProvider implements vscode.WebviewViewProvider {
  _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'jarvisApp.js')
    );

    const petUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'public', '3b1b06c4-6aee-4ec5-bbd3-a82cd6693ca8.png'));
    const videoUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'public', 'no_just_make_a_video_of_the_ro.mp4'));
    const walkSpriteUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'public', 'genouk-walk.png'));

    const nonce = getNonce();

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; media-src ${webview.cspSource}; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline';">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Genouk Pet</title>
      </head>
      <body style="padding: 0; margin: 0; background: transparent !important; overflow: hidden;">
        <div id="root"></div>
        <script nonce="${nonce}">
          window.PET_IMAGES = [
            "${petUri}"
          ];
          window.PET_VIDEO = "${videoUri}";
          window.PET_WALK_SPRITE = "${walkSpriteUri}";
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
