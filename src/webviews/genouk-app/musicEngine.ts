/**
 * Score-reactive music. When a prompt review comes back, Genouk plays a short phrase
 * voiced on real sampled instruments — trumpet, french horn, strings, flute, harp —
 * whose mood matches the score: a bright brass fanfare when it's green, warm strings
 * when it's solid, a tense solo cello when it needs work, and a dissonant low-brass hit
 * when it's bad.
 *
 * The samples ship inside the extension (public/samples/<instrument>/*.mp3) and are
 * loaded with Tone.Sampler, which pitch-shifts a handful of recorded notes across the
 * whole range. They load over the webview's own URI (the CSP grants connect-src for
 * `${webview.cspSource}`), so there's still no external network dependency at runtime.
 */
import * as Tone from 'tone';

export type MusicTier = 'triumphant' | 'good' | 'uneasy' | 'chaos';

export interface MusicCue {
  tier: MusicTier;
  /** Human-facing one-liner describing the vibe that just played. */
  label: string;
}

/** Base webview URI for the bundled samples, injected by the extension HTML. */
const SAMPLES: string = (typeof window !== 'undefined' && (window as any).GENOUK_SAMPLES) || '';

let audioStarted = false;
let samplesReady = false;

// Master chain: instruments → reverb (concert-hall space) → EQ (gentle polish) → limiter.
let limiter: Tone.Limiter | null = null;
let masterEq: Tone.EQ3 | null = null;
let reverb: Tone.Reverb | null = null;
// Sampled instruments.
let trumpet: Tone.Sampler | null = null;
let horn: Tone.Sampler | null = null;
let cello: Tone.Sampler | null = null;
let violin: Tone.Sampler | null = null;
let flute: Tone.Sampler | null = null;
let harp: Tone.Sampler | null = null;

let leadSynth: Tone.PolySynth | null = null;
let bellSynth: Tone.Synth | null = null;
let bassSynth: Tone.Synth | null = null;
// Dedicated, loud, mid-range synth for one-shot SFX so they're clearly audible on
// laptop speakers (deep bass tones get rolled off and sound like "nothing played").
let sfxSynth: Tone.PolySynth | null = null;

/**
 * Web Audio refuses to start until a user gesture. Call this from inside a click
 * handler (e.g. "Review prompt"); it starts the context, builds the instruments, and
 * resolves once every sample buffer has loaded so the first phrase plays in full.
 */
export async function ensureAudio(): Promise<void> {
  if (audioStarted) {
    if (!samplesReady) await Tone.loaded();
    return;
  }
  await Tone.start();
  audioStarted = true;

  limiter = new Tone.Limiter(-1).toDestination();
  masterEq = new Tone.EQ3({ low: 1.5, mid: 0, high: -1.5, lowFrequency: 250, highFrequency: 4000 }).connect(limiter);
  reverb = new Tone.Reverb({ decay: 3.6, preDelay: 0.02, wet: 0.28 }).connect(masterEq);

  const make = (instrument: string, urls: Record<string, string>, db: number, release = 1): Tone.Sampler =>
    new Tone.Sampler({ urls, baseUrl: `${SAMPLES}${instrument}/`, release, volume: db }).connect(reverb!);

  trumpet = make('trumpet', { A3: 'A3.mp3', C4: 'C4.mp3', F4: 'F4.mp3', G4: 'G4.mp3', 'A#4': 'As4.mp3', D5: 'D5.mp3', A5: 'A5.mp3', C6: 'C6.mp3' }, -9, 0.6);
  horn = make('french-horn', { C2: 'C2.mp3', F3: 'F3.mp3', A3: 'A3.mp3', C4: 'C4.mp3', D5: 'D5.mp3' }, -11, 1.4);
  cello = make('cello', { C2: 'C2.mp3', G2: 'G2.mp3', C3: 'C3.mp3', E3: 'E3.mp3', G3: 'G3.mp3', C4: 'C4.mp3', E4: 'E4.mp3', A4: 'A4.mp3' }, -10, 1.2);
  violin = make('violin', { G3: 'G3.mp3', C4: 'C4.mp3', E4: 'E4.mp3', G4: 'G4.mp3', A4: 'A4.mp3', C5: 'C5.mp3', E5: 'E5.mp3', A5: 'A5.mp3' }, -12, 1.0);
  flute = make('flute', { C4: 'C4.mp3', E4: 'E4.mp3', A4: 'A4.mp3', C5: 'C5.mp3', E5: 'E5.mp3', A5: 'A5.mp3' }, -13, 0.8);
  harp = make('harp', { C3: 'C3.mp3', E3: 'E3.mp3', G3: 'G3.mp3', C5: 'C5.mp3', E5: 'E5.mp3', A6: 'A6.mp3' }, -11, 1.6);

  bassSynth = new Tone.Synth({
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.02, decay: 0.25, sustain: 0.3, release: 0.5 },
  }).connect(reverb);
  bassSynth.volume.value = -14;

  sfxSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'square' },
    envelope: { attack: 0.004, decay: 0.14, sustain: 0.08, release: 0.18 },
  }).toDestination(); // dry + loud so SFX cut through
  sfxSynth.volume.value = -3;

  await Tone.loaded();
  samplesReady = true;
}

/** Whether Web Audio has been unlocked (a user gesture happened). */
export function isAudioStarted(): boolean {
  return audioStarted;
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
  triumphant: 'Brass fanfare — that prompt is sharp.',
  good: 'Warm strings — good prompt, still room to tighten.',
  uneasy: 'Tense cello — this prompt needs work.',
  chaos: 'Dissonant hit — the prompt is in rough shape.',
};

/**
 * Play a phrase for the given score tier. Returns the cue so the UI can show what just
 * played. Safe to call repeatedly; phrases are short and overlap gracefully.
 */
export function playForScore(score: number): MusicCue {
  const tier = scoreToTier(score);
  playTier(tier);
  return { tier, label: TIER_LABEL[tier] };
}

export function playTier(tier: MusicTier): MusicCue {
  if (!samplesReady || !trumpet || !horn || !cello || !violin || !flute || !harp) {
    return { tier, label: TIER_LABEL[tier] };
  }
  const now = Tone.now() + 0.06;
  PHRASES[tier](now);
  return { tier, label: TIER_LABEL[tier] };
}

/* ------------------------------------------------------------------ *
 * Selectable sound effects (Personalization tab).
 *
 * Short synthesized one-shots the user can assign to events: a good compile,
 * a bad compile, and an "agent needs attention" notification. Like the music
 * phrases these are generated live, so the user gets a menu of distinct sounds
 * without us shipping a single audio file.
 * ------------------------------------------------------------------ */

export type SfxName =
  | 'chime' | 'fanfare' | 'powerUp' | 'coin'
  | 'buzz' | 'descend' | 'thud' | 'glitch'
  | 'ping' | 'pop' | 'knock';

export interface SfxOption { name: SfxName; label: string; }

/** Curated menus per slot (any sound is allowed, but these read sensibly). */
export const SFX_MENU: { good: SfxOption[]; bad: SfxOption[]; notification: SfxOption[] } = {
  good: [
    { name: 'chime', label: 'Chime' },
    { name: 'fanfare', label: 'Fanfare' },
    { name: 'powerUp', label: 'Power-up' },
    { name: 'coin', label: 'Coin' },
  ],
  bad: [
    { name: 'buzz', label: 'Buzzer' },
    { name: 'descend', label: 'Sad trombone' },
    { name: 'thud', label: 'Thud' },
    { name: 'glitch', label: 'Glitch' },
  ],
  notification: [
    { name: 'ping', label: 'Ping' },
    { name: 'pop', label: 'Pop' },
    { name: 'knock', label: 'Knock' },
    { name: 'chime', label: 'Chime' },
  ],
};

/** Play a one-shot SFX by name. No-op until audio has been unlocked. */
export function playSfx(name: SfxName): void {
  if (!audioStarted || !sfxSynth) return;
  const t = Tone.now() + 0.02;
  (SFX[name] ?? SFX.ping)(t);
}

// All SFX use the loud, dry, mid-range sfxSynth so they're clearly audible. Notes
// stay in octaves 4-6 (~260 Hz+) which laptop speakers reproduce well.
const beep = (notes: string[], start: number, step: number, dur = '0.12', vel = 0.9) =>
  notes.forEach((n, i) => sfxSynth!.triggerAttackRelease(n, dur, start + i * step, vel));

const SFX: Record<SfxName, (t: number) => void> = {
  chime: (t) => beep(['C5', 'E5', 'G5'], t, 0.1, '0.16'),
  fanfare: (t) => { sfxSynth!.triggerAttackRelease(['C5', 'E5', 'G5'], '0.35', t, 0.9); beep(['C6'], t + 0.14, 0, '0.3'); },
  powerUp: (t) => beep(['C5', 'E5', 'G5', 'C6'], t, 0.06, '0.1'),
  coin: (t) => { beep(['B5'], t, 0, '0.08'); beep(['E6'], t + 0.08, 0, '0.28'); },
  buzz: (t) => { sfxSynth!.triggerAttackRelease(['A4', 'Bb4'], '0.18', t, 0.9); sfxSynth!.triggerAttackRelease(['A4', 'Bb4'], '0.18', t + 0.22, 0.9); },
  descend: (t) => beep(['G4', 'F4', 'Eb4', 'D4'], t, 0.14, '0.18'),
  thud: (t) => { sfxSynth!.triggerAttackRelease('C3', '0.22', t, 1.0); sfxSynth!.triggerAttackRelease('G3', '0.18', t + 0.02, 0.7); },
  glitch: (t) => beep(['C5', 'Gb5', 'C5', 'A5'], t, 0.05, '0.06'),
  ping: (t) => beep(['G5', 'C6'], t, 0.1, '0.16'),
  pop: (t) => beep(['C6'], t, 0, '0.09'),
  knock: (t) => beep(['C4', 'C4'], t, 0.14, '0.08'),
};

type Phrase = (t: number) => void;

/** Play a melodic run on one instrument, one note per step. */
const run = (inst: Tone.Sampler, notes: string[], start: number, step: number, dur: Tone.Unit.Time, vel = 0.8) => {
  notes.forEach((n, i) => inst.triggerAttackRelease(n, dur, start + i * step, vel));
};

const PHRASES: Record<MusicTier, Phrase> = {
  // Bright C-major brass fanfare: french-horn + cello bed, a harp arpeggio sweep up,
  // and a trumpet call (IV–V–I) that lands on a held major triad with high harp sparkle.
  triumphant: (t) => {
    horn!.triggerAttackRelease(['C3', 'E3', 'G3'], 2.6, t, 0.6);
    horn!.triggerAttackRelease(['F3', 'A3', 'C4'], 0.8, t + 1.15, 0.55);
    horn!.triggerAttackRelease(['G3', 'B3', 'D4'], 0.7, t + 1.6, 0.6);
    cello!.triggerAttackRelease('C2', 1.1, t, 0.8);
    cello!.triggerAttackRelease('G2', 0.5, t + 1.15, 0.7);
    cello!.triggerAttackRelease('C2', 1.4, t + 1.6, 0.85);
    run(harp!, ['C4', 'E4', 'G4', 'C5', 'E5', 'G5'], t + 0.02, 0.07, 1.2, 0.65);
    // Trumpet fanfare: a confident rising call resolving to the tonic triad.
    trumpet!.triggerAttackRelease('G4', 0.18, t + 0.1, 0.85);
    trumpet!.triggerAttackRelease('G4', 0.18, t + 0.32, 0.8);
    trumpet!.triggerAttackRelease('C5', 0.32, t + 0.54, 0.9);
    trumpet!.triggerAttackRelease('E5', 0.5, t + 0.86, 0.92);
    trumpet!.triggerAttackRelease(['C5', 'E5', 'G5'], 1.7, t + 1.6, 0.95);
    harp!.triggerAttackRelease('C6', 1.6, t + 1.66, 0.6);
    harp!.triggerAttackRelease('E6', 1.5, t + 1.82, 0.5);
    harp!.triggerAttackRelease('G6', 1.6, t + 1.98, 0.42);
  },
  // Warm and content F major: a violin string bed with a gentle rising flute motif that
  // resolves but holds back the full victory. "Good — keep going."
  good: (t) => {
    violin!.triggerAttackRelease(['F3', 'A3', 'C4'], 2.2, t, 0.55);
    violin!.triggerAttackRelease(['E4', 'G4', 'C5'], 1.3, t + 1.4, 0.5);
    cello!.triggerAttackRelease('F2', 1.1, t, 0.7);
    cello!.triggerAttackRelease('C3', 1.0, t + 1.4, 0.6);
    flute!.triggerAttackRelease('A4', 0.42, t + 0.25, 0.7);
    flute!.triggerAttackRelease('C5', 0.42, t + 0.6, 0.72);
    flute!.triggerAttackRelease('D5', 0.5, t + 0.95, 0.7);
    flute!.triggerAttackRelease('C5', 1.4, t + 1.4, 0.78);
  },
  // Suspended A minor on solo cello: a slow, slightly chromatic descent that never lands
  // on the tonic, with a thin high violin holding the tension. Clearly unresolved.
  uneasy: (t) => {
    cello!.triggerAttackRelease(['A2', 'E3'], 2.4, t, 0.6);
    cello!.triggerAttackRelease('A3', 0.7, t + 0.1, 0.6);
    run(cello!, ['E3', 'D3', 'C3', 'B2'], t + 0.7, 0.42, 0.6, 0.55);
    // Unresolved suspension: a Bsus over F, no tonic landing.
    cello!.triggerAttackRelease(['B2', 'F3'], 1.8, t + 1.6, 0.5);
    violin!.triggerAttackRelease('D5', 1.8, t + 1.6, 0.32);
  },
  // Dark and dissonant: a low french-horn/cello cluster with a tritone, a stabbed
  // trumpet cluster, and a falling chromatic collapse. The "this is bad" hit.
  chaos: (t) => {
    horn!.triggerAttackRelease(['C2', 'F#2'], 1.8, t, 0.65);
    cello!.triggerAttackRelease('C2', 0.6, t, 0.85);
    cello!.triggerAttackRelease('F#2', 0.7, t + 0.45, 0.75);
    trumpet!.triggerAttackRelease(['C4', 'F#4', 'B4'], 0.4, t + 0.08, 0.8);
    trumpet!.triggerAttackRelease(['B3', 'F4', 'A4'], 0.4, t + 0.5, 0.72);
    run(trumpet!, ['G4', 'F#4', 'F4', 'E4', 'D#4', 'D4'], t + 1.0, 0.11, 0.24, 0.62);
    cello!.triggerAttackRelease('C2', 1.4, t + 1.7, 0.7);
  },
};
