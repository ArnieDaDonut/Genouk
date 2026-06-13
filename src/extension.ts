import * as vscode from 'vscode';
import { JarvisSidebarProvider } from './JarvisSidebarProvider';

export function activate(context: vscode.ExtensionContext) {
  console.log('Jarvis extension is now active!');

  const sidebarProvider = new JarvisSidebarProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'jarvis.sidebar',
      sidebarProvider
    )
  );
}

export function deactivate() {}
