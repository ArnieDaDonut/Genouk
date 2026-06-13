import * as vscode from 'vscode';
import { GenoukSidebarProvider } from './GenoukSidebarProvider';
import { SessionStore } from './SessionStore';
import { PlannerPanel } from './PlannerPanel';

import { LinearService } from './LinearService';
import { TodoScanner } from './TodoScanner';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
  console.log('Genouk extension is now active!');

  const store = new SessionStore(context);
  context.subscriptions.push(store);

  const sidebarProvider = new GenoukSidebarProvider(context, store);
  vscode.commands.executeCommand('setContext', 'genouk.liveTour', false);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'genouk.sidebar',
      sidebarProvider,
      // Keep the webview (and its unlocked AudioContext) alive when hidden, so
      // event sounds still play when you've switched to another sidebar view.
      { webviewOptions: { retainContextWhenHidden: true } }
    ),
    vscode.commands.registerCommand('genouk.openPlanner', () => {
      PlannerPanel.createOrShow(context.extensionUri, store);
    }),
    vscode.commands.registerCommand('genouk.tourNext', () => {
      sidebarProvider.nextTourStop();
    }),
    vscode.commands.registerCommand('genouk.tourPrevious', () => {
      sidebarProvider.previousTourStop();
    }),
    vscode.commands.registerCommand('genouk.syncTodosToLinear', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active file to scan.');
        return;
      }

      const config = vscode.workspace.getConfiguration('genouk');
      const apiKey = config.get<string>('linearApiKey');
      const teamId = config.get<string>('linearTeamId');

      if (!apiKey || !teamId) {
        vscode.window.showErrorMessage('Please configure genouk.linearApiKey and genouk.linearTeamId in settings.');
        return;
      }

      const document = editor.document;
      const todos = TodoScanner.scanDocument(document);

      if (todos.length === 0) {
        vscode.window.showInformationMessage('No unsynced TODOs found in this file.');
        return;
      }

      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Syncing TODOs to Linear...",
        cancellable: false
      }, async (progress) => {
        let syncedCount = 0;
        const workspaceEdit = new vscode.WorkspaceEdit();

        for (const todo of todos) {
          try {
            const fileName = path.basename(document.fileName);
            const title = `[Genouk] ${todo.type} in ${fileName}`;
            const description = `${todo.text}\n\nFile: \`${document.fileName}\`\nLine: ${todo.range.start.line + 1}`;
            
            const issueKey = await LinearService.createIssueFromTodo(title, description, apiKey, teamId);
            
            const replacementSeparator = todo.match4 || ': ';
            const replacementText = `${todo.match1} [${issueKey}]${replacementSeparator}${todo.match5}`;
            
            workspaceEdit.replace(document.uri, todo.range, replacementText);
            syncedCount++;
          } catch (e) {
            console.error('Failed to sync TODO:', e);
          }
        }

        if (syncedCount > 0) {
          await vscode.workspace.applyEdit(workspaceEdit);
          await document.save();
          vscode.window.showInformationMessage(`Successfully synced ${syncedCount} TODO(s) to Linear!`);
        } else {
          vscode.window.showErrorMessage('Failed to sync any TODOs.');
        }
      });
    })
  );
}

export function deactivate() {}
