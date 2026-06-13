import * as child_process from 'child_process';
import * as path from 'path';
import { VibeState, VIBE_SOUNDS } from './types';
import { logger } from '../shared/logger';

let currentProcess: child_process.ChildProcess | null = null;
let lastState: VibeState | null = null;

/**
 * Play the sound associated with a vibe state.
 * Kills any currently playing sound first.
 * No-op if the state hasn't changed (avoids replaying same track).
 */
export function playSoundForState(
  state: VibeState,
  soundsDir: string,
  volume: number
): void {
  // Don't replay the same state (except compile — always play)
  if (state === lastState && state !== 'compile') return;
  lastState = state;

  const file = path.join(soundsDir, VIBE_SOUNDS[state]);
  stopCurrentSound();

  try {
    const cmd = buildPlayCommand(file, volume);
    if (!cmd) {
      logger.warn(`SoundEngine: No audio player available on this platform (${process.platform})`);
      return;
    }
    logger.info(`SoundEngine: Playing "${VIBE_SOUNDS[state]}" (state: ${state})`);
    currentProcess = child_process.spawn(cmd.bin, cmd.args, { stdio: 'ignore', detached: false });
    currentProcess.on('error', (err) => {
      logger.warn(`SoundEngine: Playback error — ${err.message}`);
    });
  } catch (err) {
    logger.warn('SoundEngine: Failed to start audio player', err);
  }
}

export function stopCurrentSound(): void {
  if (currentProcess) {
    try { currentProcess.kill(); } catch { /* already dead */ }
    currentProcess = null;
  }
}

export function resetSoundState(): void {
  lastState = null;
  stopCurrentSound();
}

/** Build the platform-appropriate play command */
function buildPlayCommand(
  file: string,
  volume: number
): { bin: string; args: string[] } | null {
  const vol01 = volume / 100; // 0.0 – 1.0

  switch (process.platform) {
    case 'darwin':
      // macOS: afplay supports -v (volume 0.0–1.0)
      return { bin: 'afplay', args: ['-v', String(vol01), file] };

    case 'linux':
      // Try mpv first (most common), fall back to aplay
      return { bin: 'mpv', args: ['--no-video', `--volume=${volume}`, file] };

    case 'win32':
      // PowerShell one-liner
      return {
        bin: 'powershell.exe',
        args: [
          '-c',
          `$player = New-Object Media.SoundPlayer '${file}'; $player.PlaySync()`,
        ],
      };

    default:
      return null;
  }
}
