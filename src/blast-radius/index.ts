import * as vscode from 'vscode';
import { analyzeBlastRadius } from './analyzer';
import { applyDecorations, clearDecorations, disposeDecorations } from './overlayDecorator';
import { BlastRadiusSidebarPanel } from './sidebarPanel';
import { BlastRadiusWebviewPanel } from './webviewPanel';
import { getBlastRadiusMaxDepth } from '../shared/config';
import { logger } from '../shared/logger';

export class BlastRadiusProvider implements vscode.Disposable {
  private sidebar: BlastRadiusSidebarPanel;
  private treeView: vscode.TreeView<unknown>;
  private webviewPanel: BlastRadiusWebviewPanel;
  private disposables: vscode.Disposable[] = [];

  constructor(context: vscode.ExtensionContext) {
    this.sidebar = new BlastRadiusSidebarPanel();
    this.treeView = vscode.window.createTreeView('detonate.blastRadiusTree', {
      treeDataProvider: this.sidebar,
      showCollapseAll: true,
    });
    this.webviewPanel = new BlastRadiusWebviewPanel(context.extensionUri);
    this.disposables.push(this.treeView, this.webviewPanel);
  }

  /** Run blast radius analysis on the current cursor position */
  async run(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Detonate: Open a file and place your cursor on a symbol first.');
      return;
    }

    const position = editor.selection.active;
    const maxDepth = getBlastRadiusMaxDepth();

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: '🔥 Calculating blast radius...',
        cancellable: false,
      },
      async () => {
        try {
          const result = await analyzeBlastRadius(editor.document, position, maxDepth);
          if (!result) {
            vscode.window.showInformationMessage('Detonate: No symbol found at cursor. Place cursor on a function or variable name.');
            return;
          }

          // Update sidebar
          this.sidebar.setResult(result);

          // Apply editor decorations
          applyDecorations(result.allNodes);

          // Reveal sidebar and React Webview
          await vscode.commands.executeCommand('workbench.view.explorer');
          this.webviewPanel.showResult(result);

          const totalCallers = result.allNodes.length - 1;
          const fileCount = result.affectedFiles.length;

          if (totalCallers === 0) {
            vscode.window.showInformationMessage(
              `✅ "${result.root.symbol}" has no callers — safe to change!`
            );
          } else {
            vscode.window.showWarningMessage(
              `🔥 Blast Radius: ${totalCallers} caller(s) across ${fileCount} file(s) would be affected.`
            );
          }

          logger.info(
            `Blast Radius complete: ${totalCallers} callers, ${fileCount} files, depth ${result.maxDepth}`
          );
        } catch (err) {
          logger.error('Blast Radius analysis failed', err);
          vscode.window.showErrorMessage(`Detonate: Analysis failed — ${(err as Error).message}`);
        }
      }
    );
  }

  /** Clear all blast radius decorations and reset the sidebar */
  clear(): void {
    clearDecorations();
    this.sidebar.setResult(null);
    logger.info('Blast Radius cleared.');
  }

  dispose(): void {
    this.clear();
    disposeDecorations();
    this.sidebar.dispose();
    this.webviewPanel.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}

// Re-export for extension.ts import
export { BlastRadiusProvider as default };
