import * as vscode from 'vscode';
import { logger } from './shared/logger';
import { BlastRadiusProvider } from './blast-radius';
import { CodeTeacherProvider } from './code-teacher';
import { VibeScoreProvider } from './vibe-score';

// Providers kept alive for the extension lifetime
let blastRadius: BlastRadiusProvider;
let codeTeacher: CodeTeacherProvider;
let vibeScore: VibeScoreProvider;

export function activate(context: vscode.ExtensionContext): void {
  logger.info('🔥 Detonate activating...');

  // ── Blast Radius ───────────────────────────────────────────────────────────
  blastRadius = new BlastRadiusProvider(context);
  context.subscriptions.push(
    blastRadius,
    vscode.commands.registerCommand('detonate.blastRadius', () => blastRadius.run()),
    vscode.commands.registerCommand('detonate.clearBlastRadius', () => blastRadius.clear()),
  );

  // ── Code Teacher ───────────────────────────────────────────────────────────
  codeTeacher = new CodeTeacherProvider(context);
  context.subscriptions.push(
    codeTeacher,
    vscode.commands.registerCommand('detonate.explainCode', () => codeTeacher.explainSelection()),
    // Hover provider registered for all languages
    vscode.languages.registerHoverProvider(
      { scheme: 'file' },
      codeTeacher.hoverProvider(),
    ),
  );

  // ── Vibe Score ─────────────────────────────────────────────────────────────
  vibeScore = new VibeScoreProvider(context);
  context.subscriptions.push(
    vibeScore,
    vscode.commands.registerCommand('detonate.toggleVibe', () => vibeScore.toggle()),
    vscode.commands.registerCommand('detonate.connectSpotify', () => vibeScore.connectSpotify()),
  );

  logger.info('✅ Detonate active. Press Cmd+Shift+D for Blast Radius, Cmd+Shift+E to explain code.');

  // Visible confirmation that the extension actually loaded in this window,
  // with a one-click shortcut to the Detonate output channel for diagnostics.
  void vscode.window
    .showInformationMessage(
      '🔥 Detonate is active. Click in a code file, put your cursor on a function name, then press Ctrl+Shift+D.',
      'Show Logs'
    )
    .then((choice) => {
      if (choice === 'Show Logs') logger.show();
    });
}

export function deactivate(): void {
  logger.info('Detonate deactivating.');
  logger.dispose();
}
