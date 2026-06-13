import * as vscode from 'vscode';
import { JarvisSidebarProvider } from './JarvisSidebarProvider';
import { SessionStore } from './SessionStore';
import { PlannerPanel } from './PlannerPanel';

export function activate(context: vscode.ExtensionContext) {
  console.log('Jarvis extension is now active!');

  const store = new SessionStore(context);
  context.subscriptions.push(store);

  const sidebarProvider = new JarvisSidebarProvider(context, store);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'jarvis.sidebar',
      sidebarProvider,
      // Keep the webview (and its unlocked AudioContext) alive when hidden, so
      // event sounds still play when you've switched to another sidebar view.
      { webviewOptions: { retainContextWhenHidden: true } }
    ),
    vscode.commands.registerCommand('genouk.openPlanner', () => {
      PlannerPanel.createOrShow(context.extensionUri, store);
    })
  );
}

export function deactivate() {}
