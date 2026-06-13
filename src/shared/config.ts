import * as vscode from 'vscode';

const SECTION = 'detonate';

export function getConfig<T>(key: string, fallback: T): T {
  return vscode.workspace.getConfiguration(SECTION).get<T>(key, fallback);
}

export function getGeminiApiKey(): string {
  return getConfig<string>('geminiApiKey', '');
}

export function getVibeSound(): boolean {
  return getConfig<boolean>('vibeSound', true);
}

export function getVibeVolume(): number {
  return getConfig<number>('vibeVolume', 50);
}

export function getBlastRadiusMaxDepth(): number {
  return getConfig<number>('blastRadiusMaxDepth', 3);
}

export function getAutoBlastRadius(): boolean {
  return getConfig<boolean>('autoBlastRadius', false);
}

export function getSpotifyClientId(): string {
  return getConfig<string>('spotifyClientId', '');
}

/** Watch for configuration changes and call the callback */
export function onConfigChange(callback: () => void): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration(SECTION)) {
      callback();
    }
  });
}
