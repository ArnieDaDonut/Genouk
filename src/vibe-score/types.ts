/** A code health score from 0 to 100 */
export interface HealthScore {
  score: number;           // 0–100
  errors: number;
  warnings: number;
  hints: number;
  hasGitConflicts: boolean;
}

/** Mapping of score ranges to vibe states */
export type VibeState = 'fire' | 'chill' | 'worried' | 'chaos' | 'idle' | 'compile';

/** Map a health score to a vibe state */
export function scoreToVibeState(score: number): VibeState {
  if (score >= 80) return 'fire';
  if (score >= 60) return 'chill';
  if (score >= 40) return 'worried';
  return 'chaos';
}

/** Emoji + label for each vibe state */
export const VIBE_LABELS: Record<VibeState, string> = {
  fire:    '🔥 On Fire',
  chill:   '😎 Chill',
  worried: '😬 Worried',
  chaos:   '💀 Chaos',
  idle:    '😴 Idle',
  compile: '⚙️ Compiling',
};

/** Sound file names for each state (stored in media/sounds/) */
export const VIBE_SOUNDS: Record<VibeState, string> = {
  fire:    'vibe-fire.mp3',
  chill:   'vibe-chill.mp3',
  worried: 'vibe-worried.mp3',
  chaos:   'vibe-chaos.mp3',
  idle:    'vibe-idle.mp3',
  compile: 'vibe-compile.mp3',
};

/** OAuth token for Spotify */
export interface SpotifyToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}
