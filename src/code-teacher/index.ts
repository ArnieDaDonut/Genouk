import * as vscode from 'vscode';
import { extractContext } from './contextExtractor';
import { explainCodeStream, quickSummary, resetClient } from './geminiClient';
import { TeacherWebviewPanel } from './webviewPanel';
import { getGeminiApiKey, onConfigChange } from '../shared/config';
import { logger } from '../shared/logger';

export class CodeTeacherProvider implements vscode.Disposable {
  private webviewPanel: TeacherWebviewPanel;
  private disposables: vscode.Disposable[] = [];

  constructor(context: vscode.ExtensionContext) {
    this.webviewPanel = new TeacherWebviewPanel(context.extensionUri);

    // Reset Gemini client if API key changes in settings
    this.disposables.push(
      onConfigChange(() => resetClient())
    );
  }

  /** Command: Explain the selected code in a full webview panel */
  async explainSelection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      const action = await vscode.window.showErrorMessage(
        'Detonate: No Gemini API key set.',
        'Open Settings'
      );
      if (action === 'Open Settings') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'detonate.geminiApiKey');
      }
      return;
    }

    const req = extractContext(editor);
    if (!req) {
      vscode.window.showInformationMessage('Detonate: Select some code or place cursor on a symbol first.');
      return;
    }

    logger.info(`Code Teacher: Explaining "${req.selectedCode.slice(0, 60).trim()}…"`);

    // Open panel with loading state
    this.webviewPanel.openWithRequest(req);

    // Stream the response
    try {
      for await (const chunk of explainCodeStream(req, apiKey)) {
        this.webviewPanel.appendChunk(chunk);
      }
      this.webviewPanel.finalize();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Code Teacher: Gemini request failed', err);
      this.webviewPanel.showError(`Gemini request failed: ${msg}`);
    }
  }

  /** Returns a HoverProvider that shows a quick one-liner on hover */
  hoverProvider(): vscode.HoverProvider {
    return {
      provideHover: async (document, position, token) => {
        const apiKey = getGeminiApiKey();
        if (!apiKey) return undefined;

        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) return undefined;
        const word = document.getText(wordRange);

        // Only trigger hover for longer symbols (avoid noise on single chars)
        if (word.length < 3) return undefined;

        // Don't block hover if cancelled
        if (token.isCancellationRequested) return undefined;

        try {
          const summary = await quickSummary(word, document.languageId, apiKey);
          const md = new vscode.MarkdownString(
            `**🧠 Detonate:** ${summary}\n\n*Press \`Cmd+Shift+E\` for a full explanation.*`
          );
          md.isTrusted = true;
          return new vscode.Hover(md, wordRange);
        } catch {
          return undefined;
        }
      },
    };
  }

  dispose(): void {
    this.webviewPanel.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}

export { CodeTeacherProvider as default };
