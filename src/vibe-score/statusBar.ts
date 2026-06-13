import * as vscode from 'vscode';
import { VibeState, VIBE_LABELS, HealthScore } from './types';

export class VibeStatusBar implements vscode.Disposable {
  private item: vscode.StatusBarItem;
  private enabled: boolean = true;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      50 // priority (higher = further right)
    );
    this.item.command = 'detonate.toggleVibe';
    this.item.tooltip = 'Detonate Vibe Score — click to toggle sound';
    this.item.show();
    this.setIdle();
  }

  update(state: VibeState, health: HealthScore): void {
    if (!this.enabled) return;
    const label = VIBE_LABELS[state];
    const score = Math.round(health.score);
    this.item.text = `${label} (${score})`;
    this.item.backgroundColor = this.bgColor(state);
    this.item.tooltip = [
      `Detonate Vibe Score: ${score}/100`,
      `Errors: ${health.errors}  Warnings: ${health.warnings}`,
      `Git Conflicts: ${health.hasGitConflicts ? 'YES ⚠️' : 'No'}`,
      '',
      'Click to toggle sound effects',
    ].join('\n');
  }

  setIdle(): void {
    this.item.text = `${VIBE_LABELS['idle']} — Detonate`;
    this.item.backgroundColor = undefined;
  }

  setDisabled(): void {
    this.item.text = `🔇 Vibe (muted)`;
    this.item.backgroundColor = undefined;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.setDisabled();
  }

  private bgColor(state: VibeState): vscode.ThemeColor | undefined {
    switch (state) {
      case 'chaos':   return new vscode.ThemeColor('statusBarItem.errorBackground');
      case 'worried': return new vscode.ThemeColor('statusBarItem.warningBackground');
      default:        return undefined;
    }
  }

  dispose(): void {
    this.item.dispose();
  }
}
