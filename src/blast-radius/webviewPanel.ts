import * as vscode from 'vscode';
import * as path from 'path';
import { AnalysisResult, BlastNode } from './types';
import { getNonce } from '../shared/utils';

export class BlastRadiusWebviewPanel {
  private panel: vscode.WebviewPanel | undefined;
  private readonly extensionUri: vscode.Uri;

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
  }

  showResult(result: AnalysisResult): void {
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        'detonate.blastRadiusApp',
        '🔥 Blast Radius',
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.joinPath(this.extensionUri, 'dist'),
            vscode.Uri.joinPath(this.extensionUri, 'src', 'webviews', 'blast-radius-app'),
          ],
        }
      );

      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });

      // Handle messages from the webview (e.g. click to jump to code)
      this.panel.webview.onDidReceiveMessage((message) => {
        if (message.type === 'jumpTo') {
          const fileUri = vscode.Uri.file(message.file);
          vscode.workspace.openTextDocument(fileUri).then((doc) => {
            vscode.window.showTextDocument(doc, {
              viewColumn: vscode.ViewColumn.One,
              selection: new vscode.Range(message.line, 0, message.line, 0)
            });
          });
        }
      });
      
      this.panel.webview.html = this.getHtmlForWebview();
    } else {
      this.panel.reveal(vscode.ViewColumn.Beside, true);
    }

    // Send the result to the React app
    this.panel.webview.postMessage({
      type: 'update',
      data: this.mapResultForUI(result)
    });
  }

  dispose(): void {
    this.panel?.dispose();
  }

  private mapResultForUI(result: AnalysisResult) {
    const mapNode = (n: BlastNode) => ({
      id: `${n.uri.toString()}#${n.range.start.line}`,
      symbol: n.symbol,
      file: n.uri.fsPath,
      range: {
        startLine: n.range.start.line + 1, // 1-indexed for display
        endLine: n.range.end.line + 1
      },
      depth: n.depth
    });

    return {
      root: mapNode(result.root),
      allNodes: result.allNodes.map(mapNode),
      maxDepth: result.maxDepth
    };
  }

  private getHtmlForWebview(): string {
    const nonce = getNonce();
    
    // URIs for loading the bundled React app and CSS
    const scriptUri = this.panel!.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'blastRadiusApp.js')
    );
    const styleUri = this.panel!.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'src', 'webviews', 'blast-radius-app', 'styles.css')
    );

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${this.panel!.webview.cspSource}; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blast Radius</title>
  <link href="${styleUri}" rel="stylesheet">
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
