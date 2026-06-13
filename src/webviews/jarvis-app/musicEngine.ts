/**
 * Score-reactive music. Instead of shipping pre-baked MP3s, we synthesize a short
 * musical phrase on the fly with Tone.js whenever a prompt review comes back — the
 * better the score, the brighter and more triumphant the phrase; the worse, the more
 * tense and dissonant. Everything runs offline in the webview (no API key, no network,
 * no latency), which matters because this webview's CSP blocks outbound requests.
 */
import * as Tone from 'tone';

export type MusicTier = 'triumphant' | 'good' | 'uneasy' | 'chaos';

export interface MusicCue {
  tier: MusicTier;
  /** Human-facing one-liner describing the vibe that just played. */
  label: string;
}

let audioStarted = false;
let reverb: Tone.Reverb | null = null;
let leadSynth: Tone.PolySynth | null = null;
let bellSynth: Tone.Synth | null = null;
let bassSynth: Tone.Synth | null = null;

/**
 * Web Audio refuses to start until a user gesture. Call this from inside a click
 * handler (e.g. "Review prompt") so the context is live by the time a phrase plays.
 */
export async function ensureAudio(): Promise<void> {
  if (audioStarted) return;
  await Tone.start();
  audioStarted = true;

  reverb = new Tone.Reverb({ decay: 2.4, wet: 0.28 }).toDestination();

  leadSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.01, decay: 0.18, sustain: 0.25, release: 0.5 },
  }).connect(reverb);
  leadSynth.volume.value = -6;

  bellSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.005, decay: 0.4, sustain: 0, release: 0.6 },
  }).connect(reverb);
  bellSynth.volume.value = -10;

  bassSynth = new Tone.Synth({
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.02, decay: 0.25, sustain: 0.3, release: 0.5 },
  }).connect(reverb);
  bassSynth.volume.value = -14;
}

/** Master volume in 0..1 (linear), with mute. Mirrors the webview's volume slider. */
export function setMasterVolume(volume: number, muted: boolean): void {
  const dest = Tone.getDestination();
  dest.volume.value = muted || volume <= 0 ? -Infinity : Tone.gainToDb(volume);
}

export function scoreToTier(score: number): MusicTier {
  if (score >= 80) return 'triumphant';
  if (score >= 60) return 'good';
  if (score >= 40) return 'uneasy';
  return 'chaos';
}

const TIER_LABEL: Record<MusicTier, string> = {
  triumphant: 'Triumphant fanfare — that prompt is sharp.',
  good: 'Warm major chord — solid, minor gaps.',
  uneasy: 'Tense minor phrase — this one needs work.',
  chaos: 'Dissonant alarm — the prompt is broken.',
};

/**
 * Synthesize and play a ~2s phrase for the given score tier. Returns the cue so the
 * UI can show what just played. Safe to call repeatedly; phrases are short and overlap
 * gracefully.
 */
export function playForScore(score: number): MusicCue {
  const tier = scoreToTier(score);
  playTier(tier);
  return { tier, label: TIER_LABEL[tier] };
}

export function playTier(tier: MusicTier): MusicCue {
  if (!audioStarted || !leadSynth || !bellSynth || !bassSynth) {
    return { tier, label: TIER_LABEL[tier] };
  }
  const now = Tone.now() + 0.05;
  PHRASES[tier](now);
  return { tier, label: TIER_LABEL[tier] };
}

type Phrase = (t: number) => void;

const lead = (notes: string[], start: number, step: number, dur: string, vel = 0.8) => {
  notes.forEach((n, i) => leadSynth!.triggerAttackRelease(n, dur, start + i * step, vel));
};

const PHRASES: Record<MusicTier, Phrase> = {
  // Bright C-major fanfare: rising arpeggio resolving on a major chord + a high sparkle.
  triumphant: (t) => {
    bassSynth!.triggerAttackRelease('C2', '0.5', t, 0.9);
    lead(['C4', 'E4', 'G4', 'C5'], t, 0.12, '0.16', 0.85);
    leadSynth!.triggerAttackRelease(['C5', 'E5', 'G5'], '0.9', t + 0.5, 0.9);
    bellSynth!.triggerAttackRelease('C6', '0.8', t + 0.62, 0.7);
    bellSynth!.triggerAttackRelease('G6', '0.8', t + 0.8, 0.5);
  },
  // Warm, settled C-major chord with a gentle rising tail.
  good: (t) => {
    bassSynth!.triggerAttackRelease('C2', '0.6', t, 0.8);
    leadSynth!.triggerAttackRelease(['C4', 'E4', 'G4'], '0.7', t, 0.8);
    lead(['G4', 'A4', 'C5'], t + 0.45, 0.16, '0.2', 0.7);
  },
  // A-minor, slower and a touch wavering — workable but uneasy.
  uneasy: (t) => {
    bassSynth!.triggerAttackRelease('A1', '0.7', t, 0.85);
    leadSynth!.triggerAttackRelease(['A3', 'C4', 'E4'], '0.8', t, 0.75);
    lead(['E4', 'D4', 'C4'], t + 0.5, 0.18, '0.22', 0.6);
  },
  // Diminished cluster + a downward chromatic stumble — something is broken.
  chaos: (t) => {
    bassSynth!.triggerAttackRelease('C2', '0.9', t, 0.9);
    bassSynth!.triggerAttackRelease('C#2', '0.9', t + 0.04, 0.7);
    leadSynth!.triggerAttackRelease(['C4', 'Eb4', 'Gb4', 'A4'], '0.9', t, 0.8);
    lead(['A4', 'Ab4', 'G4', 'Gb4', 'F4'], t + 0.45, 0.12, '0.16', 0.6);
  },
};
