import * as vscode from 'vscode';
import * as path from 'path';
import { ExplanationRequest } from './types';
import { escapeHtml, getNonce } from '../shared/utils';

export class TeacherWebviewPanel {
  private panel: vscode.WebviewPanel | undefined;
  private readonly extensionUri: vscode.Uri;

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
  }

  /** Open (or reveal) the panel and show a loading state for the given request */
  openWithRequest(req: ExplanationRequest): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside, true);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        'detonate.teacher',
        '🧠 Code Teacher',
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
        {
          enableScripts: true,
          localResourceRoots: [
            vscode.Uri.joinPath(this.extensionUri, 'src', 'webviews', 'teacher-panel'),
          ],
        }
      );
      this.panel.onDidDispose(() => { this.panel = undefined; });
    }

    this.panel.title = `🧠 ${path.basename(req.fileName)} — Teacher`;
    this.panel.webview.html = this.buildLoadingHtml(req);
  }

  /** Stream a text chunk into the webview */
  appendChunk(chunk: string): void {
    this.panel?.webview.postMessage({ type: 'chunk', text: chunk });
  }

  /** Signal that streaming is complete */
  finalize(): void {
    this.panel?.webview.postMessage({ type: 'done' });
  }

  /** Show an error message in the panel */
  showError(message: string): void {
    this.panel?.webview.postMessage({ type: 'error', message });
  }

  dispose(): void {
    this.panel?.dispose();
  }

  private buildLoadingHtml(req: ExplanationRequest): string {
    const nonce = getNonce();
    const codePreview = escapeHtml(req.selectedCode.slice(0, 800));

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code Teacher</title>
  <style>
    :root {
      --accent: #a78bfa;
      --accent2: #f472b6;
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-editor-foreground);
      --border: var(--vscode-editorWidget-border, #444);
      --code-bg: var(--vscode-textBlockQuote-background, #1e1e2e);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family, 'Segoe UI', sans-serif);
      font-size: 14px;
      background: var(--bg);
      color: var(--fg);
      padding: 20px 24px;
      line-height: 1.7;
    }

    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }

    .header-icon {
      font-size: 28px;
    }

    .header-info h1 {
      font-size: 16px;
      font-weight: 700;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .header-info p {
      font-size: 12px;
      opacity: 0.6;
      margin-top: 2px;
    }

    .code-preview {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px 16px;
      margin-bottom: 20px;
      font-family: var(--vscode-editor-font-family, 'Fira Code', monospace);
      font-size: 12px;
      overflow-x: auto;
      white-space: pre;
      max-height: 200px;
      overflow-y: auto;
    }

    .loading {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 16px 0;
      opacity: 0.8;
    }

    .spinner {
      width: 18px; height: 18px;
      border: 2px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    #response {
      line-height: 1.8;
    }

    #response h2 {
      font-size: 14px;
      font-weight: 700;
      margin: 20px 0 8px;
      color: var(--accent);
    }

    #response p { margin-bottom: 10px; }

    #response code {
      background: var(--code-bg);
      border-radius: 4px;
      padding: 2px 6px;
      font-family: monospace;
      font-size: 12px;
    }

    #response pre {
      background: var(--code-bg);
      border-radius: 8px;
      padding: 12px 16px;
      overflow-x: auto;
      margin: 10px 0;
      border: 1px solid var(--border);
    }

    #response pre code {
      background: none;
      padding: 0;
    }

    .error-box {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.4);
      border-radius: 8px;
      padding: 14px 16px;
      color: #f87171;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-icon">🧠</div>
    <div class="header-info">
      <h1>Code Teacher</h1>
      <p>${escapeHtml(req.fileName)} · ${escapeHtml(req.language)}</p>
    </div>
  </div>

  <div class="code-preview">${codePreview}</div>

  <div class="loading" id="loading">
    <div class="spinner"></div>
    <span>Analysing with Gemini…</span>
  </div>

  <div id="response"></div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const responseEl = document.getElementById('response');
    const loadingEl = document.getElementById('loading');
    let rawText = '';

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'chunk') {
        rawText += msg.text;
        // Simple markdown-to-HTML conversion for streaming
        responseEl.innerHTML = markdownToHtml(rawText);
        loadingEl.style.display = 'none';
      } else if (msg.type === 'done') {
        loadingEl.style.display = 'none';
      } else if (msg.type === 'error') {
        loadingEl.style.display = 'none';
        responseEl.innerHTML = '<div class="error-box">⚠️ ' + escapeHtml(msg.message) + '</div>';
      }
    });

    function escapeHtml(s) {
      return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function markdownToHtml(md) {
      return md
        // Code blocks
        .replace(/\`\`\`[\w]*\\n([\\s\\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>')
        // Inline code
        .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
        // Headers
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h2>$1</h2>')
        // Bold
        .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\\*(.+?)\\*/g, '<em>$1</em>')
        // Line breaks to paragraphs
        .replace(/\\n\\n/g, '</p><p>')
        .replace(/^/, '<p>')
        .replace(/$/, '</p>');
    }
  </script>
</body>
</html>`;
  }
}
