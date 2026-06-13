import * as vscode from 'vscode';
import * as path from 'path';
import { calculateHealthScore } from './codeHealthAnalyzer';
import { playSoundForState, resetSoundState, stopCurrentSound } from './soundEngine';
import { connectSpotify, adjustSpotifyVolume } from './spotifyBridge';
import { VibeStatusBar } from './statusBar';
import { scoreToVibeState, VibeState } from './types';
import { getVibeSound, getVibeVolume } from '../shared/config';
import { debounce } from '../shared/utils';
import { logger } from '../shared/logger';

const POLL_INTERVAL_MS = 6000; // re-evaluate every 6 seconds

export class VibeScoreProvider implements vscode.Disposable {
  private statusBar: VibeStatusBar;
  private soundsDir: string;
  private soundEnabled: boolean = true;
  private pollTimer: ReturnType<typeof setInterval> | undefined;
  private disposables: vscode.Disposable[] = [];

  constructor(context: vscode.ExtensionContext) {
    this.statusBar = new VibeStatusBar();
    this.soundsDir = path.join(context.extensionPath, 'media', 'sounds');
    this.soundEnabled = getVibeSound();

    // Debounced update triggered on file save and diagnostic changes
    const debouncedUpdate = debounce(() => this.updateVibe(), 1500);

    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument(() => {
        playSoundForState('compile', this.soundsDir, getVibeVolume());
        debouncedUpdate();
      }),
      vscode.languages.onDidChangeDiagnostics(() => debouncedUpdate()),
      vscode.window.onDidChangeActiveTextEditor(() => debouncedUpdate()),
    );

    // Start periodic polling
    this.pollTimer = setInterval(() => this.updateVibe(), POLL_INTERVAL_MS);

    // Initial vibe check
    this.updateVibe();
  }

  /** Core update loop — calculate health, update status bar, play sound */
  private async updateVibe(): Promise<void> {
    try {
      const health = await calculateHealthScore();
      const state: VibeState = scoreToVibeState(health.score);

      this.statusBar.update(state, health);

      if (this.soundEnabled) {
        playSoundForState(state, this.soundsDir, getVibeVolume());
        await adjustSpotifyVolume(health.score);
      }

      logger.info(`Vibe: ${state} (score ${health.score}, err ${health.errors}, warn ${health.warnings})`);
    } catch (err) {
      logger.warn('VibeScore: Update failed', err);
    }
  }

  /** Toggle sound effects on/off */
  toggle(): void {
    this.soundEnabled = !this.soundEnabled;
    this.statusBar.setEnabled(this.soundEnabled);

    if (!this.soundEnabled) {
      stopCurrentSound();
      resetSoundState();
      vscode.window.showInformationMessage('🔇 Detonate: Vibe sound muted.');
    } else {
      vscode.window.showInformationMessage('🔊 Detonate: Vibe sound enabled!');
      this.updateVibe();
    }
  }

  /** Initiate Spotify OAuth flow */
  async connectSpotify(): Promise<void> {
    await connectSpotify();
  }

  dispose(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    stopCurrentSound();
    this.statusBar.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}

export { VibeScoreProvider as default };
