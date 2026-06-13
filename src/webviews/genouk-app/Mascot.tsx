import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion, useAnimationControls } from 'framer-motion';
import { t } from './theme';
import { PromptReviewResult, SessionPlan, VibeState } from './types';
import { quip, bankForScore, QuipBank } from './quips';
import { findAccessory } from './accessories';

declare const window: any;

interface MascotProps {
  /** Live diagnostics-derived mood from the host (updateVibe). */
  vibe: VibeState;
  /** True while any AI review is in flight (prompt/change/session loading). */
  thinking: boolean;
  /** Latest prompt review; reacts when a new one arrives. */
  review: PromptReviewResult | null;
  /** Latest change-review text (INTENT + BLOCKER/WARNING/NIT). */
  changeReview: string;
  /** Latest session plan; reacts when a task completes. */
  sessionPlan: SessionPlan | null;
  /** Latest playSFX event, bumped by nonce so repeats re-trigger. */
  sfx: { kind: string; nonce: number } | null;
  /** A review the user just kicked off — sends the courier to press that button. */
  errand?: { kind: string; nonce: number } | null;
  /** Push a message to make Genouk speak (reminders, live-tour narration). */
  say?: MascotMessage | null;
  /** Bump to make Genouk walk/stroll across the panel (live-tour steps). */
  walkSignal?: number;
  /** Accessory id (accessories.ts) worn over the sprite. */
  accessory?: string;
  /** Double-click shortcut into the prompt review. */
  onDoubleActivate?: () => void;
  /** True while codebase tour is actively running. */
  tourPlaying?: boolean;
}

// Set to true if the walk sprite is drawn facing LEFT (so it faces the
// direction of travel when walking in from the left edge).
const WALK_FACES_LEFT = true;

const IDLE_MS = 45000; // no activity -> drift to sleep
const REACTION_MS = 1800; // a reaction self-clears after this

/** Resting behaviour per vibe: float pace, mood tint, and a subtle jitter flag. */
const VIBE_MOOD: Record<string, { floatDur: number; floatY: number; tint: string; jitter: boolean }> = {
  idle: { floatDur: 3.2, floatY: 6, tint: 'none', jitter: false },
  chill: { floatDur: 3.8, floatY: 5, tint: 'brightness(1.08) saturate(1.06)', jitter: false },
  fire: { floatDur: 2.6, floatY: 7, tint: 'brightness(1.1) saturate(1.18) hue-rotate(-8deg)', jitter: false },
  worried: { floatDur: 2.0, floatY: 5, tint: 'saturate(0.9) brightness(0.97)', jitter: false },
  chaos: { floatDur: 1.5, floatY: 4, tint: 'hue-rotate(-18deg) saturate(1.3) brightness(0.97)', jitter: true },
};

export interface MascotMessage {
  text: string;
  nonce: number;
}

type ReactionKind = 'cheer' | 'nod' | 'slump' | 'alarmed' | 'thumbsup' | 'save' | 'buildErr' | 'stretch' | 'perk';

interface ReactionMotion {
  animate: Record<string, any>;
  duration: number;
}

const FULL_REACTIONS: Record<ReactionKind, ReactionMotion> = {
  cheer: { animate: { y: [0, -26, 0, -12, 0], scale: [1, 1.12, 1, 1.05, 1] }, duration: 1.4 },
  nod: { animate: { y: [0, -6, 0, -4, 0] }, duration: 1.0 },
  slump: { animate: { y: [0, 10, 8], scale: [1, 0.96, 0.97], rotate: [0, -2, -1] }, duration: 1.2 },
  alarmed: { animate: { x: [0, -7, 7, -6, 6, -3, 0], rotate: [0, -3, 3, 0] }, duration: 0.9 },
  thumbsup: { animate: { y: [0, -10, 0], scale: [1, 1.06, 1] }, duration: 0.8 },
  save: { animate: { scale: [1, 0.94, 1] }, duration: 0.5 },
  buildErr: { animate: { rotate: [0, -8, 6, -4, 0], y: [0, 4, 0] }, duration: 0.9 },
  stretch: { animate: { scaleY: [1, 0.85, 1.1, 1], y: [0, 4, -2, 0] }, duration: 0.9 },
  perk: { animate: { y: [0, -8, 0], scale: [1, 1.04, 1] }, duration: 0.5 },
};

const REDUCED_REACTIONS: Record<ReactionKind, ReactionMotion> = {
  cheer: { animate: { scale: [1, 1.06, 1] }, duration: 0.6 },
  nod: { animate: { scale: [1, 1.03, 1] }, duration: 0.5 },
  slump: { animate: { opacity: [1, 0.7, 0.88] }, duration: 0.7 },
  alarmed: { animate: { opacity: [1, 0.5, 1] }, duration: 0.6 },
  thumbsup: { animate: { scale: [1, 1.04, 1] }, duration: 0.5 },
  save: { animate: { opacity: [1, 0.8, 1] }, duration: 0.4 },
  buildErr: { animate: { opacity: [1, 0.5, 1] }, duration: 0.6 },
  stretch: { animate: { scale: [1, 1.04, 1] }, duration: 0.5 },
  perk: { animate: { scale: [1, 1.04, 1] }, duration: 0.5 },
};

const completed = (status: string) => status === 'completed';

const vibeBank = (vibe: string): QuipBank => {
  if (vibe === 'chill' || vibe === 'fire' || vibe === 'worried' || vibe === 'chaos') {
    return vibe;
  }
  return 'idle';
};

const pressButton = (button: HTMLElement) => {
  button.click();
};

export const Mascot: React.FC<MascotProps> = ({ vibe, thinking, review, changeReview, sessionPlan, sfx, errand, say, walkSignal, accessory, onDoubleActivate, tourPlaying }) => {
  const walkSpriteUrl = window.PET_WALK_SPRITE || '';
  const waveSpriteUrl = window.PET_WAVE_SPRITE || '';
  const tourSpriteUrl = window.PET_TOUR_SPRITE || '';
  const reduced = useReducedMotion();

  // 'walking' -> entrance; 'arrived' -> resting/reacting.
  const [phase, setPhase] = useState<'walking' | 'arrived'>('walking');
  const [currentFrame, setCurrentFrame] = useState(0);
  const [reaction, setReaction] = useState<{ kind: ReactionKind; text: string | null } | null>(null);
  const [asleep, setAsleep] = useState(false);
  const [strolling, setStrolling] = useState(false);

  // The "courier" — a separate overlay sprite that runs across the panel to press
  // a button for you, then scurries back off the left edge.
  const [courier, setCourier] = useState<{ visible: boolean; sheet: 'walk' | 'wave' }>({ visible: false, sheet: 'walk' });
  const [courierFrame, setCourierFrame] = useState(0);
  const courierControls = useAnimationControls();
  const courierBusy = useRef(false);

  // Manual (greeting / click) bubble — distinct from reaction/thinking bubbles.
  const [manualText, setManualText] = useState('');
  const [manualVisible, setManualVisible] = useState(false);
  const [thinkingText, setThinkingText] = useState('');

  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  const greetedRef = useRef(false);

  const reactTimer = useRef<number>();
  const sleepTimer = useRef<number>();
  const manualTimer = useRef<number>();

  // External messages (focus-timer reminders, task nudges, live-tour narration).
  // Make sure Genouk has "arrived" so the bubble shows, then hold the line a
  // little longer than a casual click greeting.
  useEffect(() => {
    if (!say || !say.text) return;
    setPhase('arrived');
    setManualText(say.text);
    setManualVisible(true);
    if (manualTimer.current) clearTimeout(manualTimer.current);
    manualTimer.current = window.setTimeout(() => setManualVisible(false), 9000);
  }, [say?.nonce]);

  // Sprite sheet geometry: both sheets are 1280x1280 = 5x5 grid of 25 frames.
  const columns = 5;
  const frameCount = 25;
  const displayScale = 2.6;
  const frameSize = 128;
  const displayWidth = frameSize * displayScale;
  const displayHeight = frameSize * displayScale;

  // The courier is a smaller version of the same sheets.
  const courierScale = 0.9;
  const courierSize = frameSize * courierScale;
  const courierBgW = columns * courierSize;
  const courierBgH = (frameCount / columns) * courierSize;

  // True only when Genouk is calm enough to wander off on a stroll.
  const canStrollRef = useRef(false);
  useEffect(() => { canStrollRef.current = !reaction && !thinking && !asleep && phase === 'arrived' && !tourPlaying; }, [reaction, thinking, asleep, phase, tourPlaying]);

  // Any activity wakes the mascot and restarts the idle->sleep countdown.
  const markActivity = useCallback(() => {
    setAsleep(false);
    if (sleepTimer.current) clearTimeout(sleepTimer.current);
    sleepTimer.current = window.setTimeout(() => setAsleep(true), IDLE_MS);
  }, []);

  // Fire a brief, self-clearing reaction (ignored until Genouk has arrived).
  const react = useCallback((kind: ReactionKind, text: string | null) => {
    if (phaseRef.current !== 'arrived') return;
    markActivity();
    if (reactTimer.current) clearTimeout(reactTimer.current);
    setReaction({ kind, text });
    reactTimer.current = window.setTimeout(() => setReaction(null), REACTION_MS);
  }, [markActivity]);

  const showManual = useCallback((text: string, ms = 4000) => {
    setManualText(text);
    setManualVisible(true);
    if (manualTimer.current) clearTimeout(manualTimer.current);
    manualTimer.current = window.setTimeout(() => setManualVisible(false), ms);
  }, []);

  // Start the idle->sleep countdown once on mount; clean up timers on unmount.
  useEffect(() => {
    markActivity();
    return () => {
      if (sleepTimer.current) clearTimeout(sleepTimer.current);
      if (reactTimer.current) clearTimeout(reactTimer.current);
      if (manualTimer.current) clearTimeout(manualTimer.current);
    };
  }, [markActivity]);

  // Cycle sprite frames. Walking/strolling are brisk; sleeping is slow; else resting.
  useEffect(() => {
    const sleepingNow = asleep && !reaction && !thinking && !strolling && phase === 'arrived';
    const fps = phase === 'walking' || strolling ? 14 : sleepingNow ? 5 : 10;
    const timer = setInterval(() => setCurrentFrame((prev) => (prev + 1) % frameCount), 1000 / fps);
    return () => clearInterval(timer);
  }, [phase, asleep, reaction, thinking, strolling]);

  // Courier runs its own frame loop while it's on screen.
  useEffect(() => {
    if (!courier.visible) return;
    const fps = courier.sheet === 'walk' ? 14 : 10;
    const timer = setInterval(() => setCourierFrame((prev) => (prev + 1) % frameCount), 1000 / fps);
    return () => clearInterval(timer);
  }, [courier.visible, courier.sheet]);

  // The errand: peek in from the left, scamper to the button, press it, leave.
  const runErrand = useCallback(async (kind: string) => {
    if (courierBusy.current || !walkSpriteUrl) return;
    courierBusy.current = true;

    // Mount the courier first, then wait two frames so its motion.div is committed
    // (and a freshly-switched tab's button exists) before we drive its controls.
    setCourier({ visible: true, sheet: 'walk' });
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

    const el = document.getElementById(`genouk-btn-${kind}`) as HTMLElement | null;
    const rect = el?.getBoundingClientRect();
    const startX = -courierSize;
    const peekX = 6;
    const targetY = rect ? rect.top + rect.height / 2 - courierSize / 2 : 110;
    const standX = rect ? Math.max(8, rect.left - courierSize * 0.55) : window.innerWidth * 0.3;
    // The walk sheet faces left, so mirror it (scaleX -1) to face right while travelling.
    const faceRight = WALK_FACES_LEFT ? -1 : 1;
    const faceLeft = WALK_FACES_LEFT ? 1 : -1;

    try {
      courierControls.set({ x: startX, y: targetY, opacity: 0, scaleX: faceRight });
      await courierControls.start({ opacity: 1, x: peekX, transition: { duration: 0.35, ease: 'easeOut' } });
      // A little peek-look before committing.
      await courierControls.start({ y: targetY - 6, transition: { duration: 0.18 } });
      await courierControls.start({ y: targetY, transition: { duration: 0.18 } });
      // Scamper over to the button.
      const dur = Math.min(1.4, Math.max(0.5, Math.abs(standX - peekX) / 600));
      await courierControls.start({ x: standX, transition: { duration: dur, ease: 'easeInOut' } });
      // Press it.
      setCourier({ visible: true, sheet: 'wave' });
      if (el) pressButton(el);
      await courierControls.start({ x: standX + 16, y: targetY + 4, transition: { duration: 0.12, ease: 'easeOut' } });
      await courierControls.start({ x: standX, y: targetY, transition: { duration: 0.12 } });
      // Turn around and scurry back off the left edge.
      setCourier({ visible: true, sheet: 'walk' });
      await courierControls.start({ scaleX: faceLeft, transition: { duration: 0.12 } });
      await courierControls.start({ x: startX, opacity: 0, transition: { duration: 0.5, ease: 'easeIn' } });
    } finally {
      setCourier({ visible: false, sheet: 'walk' });
      courierBusy.current = false;
    }
  }, [walkSpriteUrl, courierSize, courierControls]);

  // Fire the courier when a new errand arrives (skipped under reduced motion).
  const prevErrand = useRef(0);
  useEffect(() => {
    if (!errand || errand.nonce === prevErrand.current) return;
    prevErrand.current = errand.nonce;
    if (reduced) return;
    runErrand(errand.kind);
  }, [errand, reduced, runErrand]);

  // Live-tour step: make Genouk walk across the panel on each new signal.
  const prevWalk = useRef(0);
  useEffect(() => {
    if (!walkSignal || walkSignal === prevWalk.current) return;
    prevWalk.current = walkSignal;
    if (reduced) return;
    markActivity();
    setPhase('arrived');
    setStrolling(true);
    const id = window.setTimeout(() => setStrolling(false), 4600);
    return () => clearTimeout(id);
  }, [walkSignal, reduced, markActivity]);

  // Occasional idle stroll across the panel (disabled under reduced motion).
  useEffect(() => {
    if (reduced) return;
    let strollTimer: number;
    let endTimer: number;
    const schedule = () => {
      strollTimer = window.setTimeout(() => {
        if (canStrollRef.current && !courierBusy.current) {
          markActivity();
          setStrolling(true);
          endTimer = window.setTimeout(() => setStrolling(false), 4600);
        }
        schedule();
      }, 28000 + Math.random() * 30000);
    };
    schedule();
    return () => { clearTimeout(strollTimer); clearTimeout(endTimer); };
  }, [reduced, markActivity]);

  // Greet once Genouk arrives.
  useEffect(() => {
    if (tourPlaying) return;
    if (greetedRef.current) return;
    if (phase !== 'arrived') return;
    greetedRef.current = true;
    showManual(quip('greeting'), 6000);
    markActivity();
  }, [phase, showManual, markActivity, tourPlaying]);

  // --- Reaction triggers (derived from existing signals) ---

  // Prompt review result -> cheer / nod / slump by score.
  const prevReview = useRef(review);
  useEffect(() => {
    if (review && review !== prevReview.current) {
      const bank = bankForScore(review.score);
      react(bank as ReactionKind, `Score ${review.score} — ${quip(bank)}`);
    }
    prevReview.current = review;
  }, [review, react]);

  // Change review -> alarmed on any BLOCKER, thumbs-up when clean.
  const prevChange = useRef(changeReview);
  useEffect(() => {
    if (changeReview && changeReview !== prevChange.current) {
      const hasBlocker = /\bBLOCKER\s*[:\-]/i.test(changeReview);
      if (hasBlocker) react('alarmed', quip('blocker'));
      else react('thumbsup', quip('clean'));
    }
    prevChange.current = changeReview;
  }, [changeReview, react]);

  // playSFX -> quiet blink on save, celebratory hop on build pass, facepalm on fail.
  const prevSfx = useRef(0);
  useEffect(() => {
    if (!sfx || sfx.nonce === prevSfx.current) return;
    prevSfx.current = sfx.nonce;
    if (sfx.kind === 'compile') react('save', null); // save fires often: motion only, no bubble
    else if (sfx.kind === 'compile-success') react('cheer', quip('buildOk'));
    else if (sfx.kind === 'compile-error') react('buildErr', quip('buildErr'));
  }, [sfx, react]);

  // Session task completion -> cheer at 100%, milestone at 50%, else a small thumbs-up.
  const prevPlan = useRef(sessionPlan);
  useEffect(() => {
    const prev = prevPlan.current;
    if (sessionPlan?.tasks && prev?.tasks) {
      const total = sessionPlan.tasks.length;
      const prevDone = prev.tasks.filter((t) => completed(t.status)).length;
      const nowDone = sessionPlan.tasks.filter((t) => completed(t.status)).length;
      if (total > 0 && nowDone > prevDone) {
        if (nowDone === total) react('cheer', 'All tasks done — nice work! 🏁');
        else if (prevDone < total / 2 && nowDone >= total / 2) react('cheer', 'Halfway there. Keep going!');
        else react('thumbsup', quip('sessionDone'));
      }
    }
    prevPlan.current = sessionPlan;
  }, [sessionPlan, react]);

  // Thinking: pick a line when a review starts; counts as activity.
  useEffect(() => {
    if (thinking) {
      setThinkingText(quip('thinking'));
      markActivity();
    }
  }, [thinking, markActivity]);

  // --- Interactions ---

  const handleClick = () => {
    if (tourPlaying) return;
    if (phase !== 'arrived') return;
    const wasAsleep = asleep;
    markActivity();
    if (wasAsleep) react('stretch', null);
    showManual(quip(vibeBank(vibe.vibe)));
  };

  const handleHover = () => {
    if (tourPlaying) return;
    if (phase !== 'arrived' || reaction) return;
    react('perk', null);
  };

  const handleDoubleClick = () => {
    if (tourPlaying) return;
    if (phase !== 'arrived') return;
    markActivity();
    onDoubleActivate?.();
  };

  // --- Derived visual state + bubble ---

  const mood = VIBE_MOOD[vibe.vibe] || VIBE_MOOD.idle;
  const sleepingNow = !reaction && !thinking && !strolling && asleep && phase === 'arrived';

  const reactionText = reaction?.text ?? null;
  const bubbleText = reactionText
    ?? (!reaction && thinking ? thinkingText
      : sleepingNow ? quip('sleep')
        : manualVisible ? manualText
          : null);
  const bubbleVisible = phase === 'arrived' && !!bubbleText;

  const useWalkSheet = phase === 'walking' || (strolling && !tourPlaying);
  const useTourSheet = (tourPlaying && strolling) || (tourPlaying && phase === 'arrived' && !!say);
  const spriteUrl = useWalkSheet ? walkSpriteUrl : (useTourSheet ? tourSpriteUrl : waveSpriteUrl);
  const col = currentFrame % columns;
  const row = Math.floor(currentFrame / columns);
  const bgPosX = -(col * displayWidth);
  const bgPosY = -(row * displayHeight);
  const bgSizeW = columns * displayWidth;
  const bgSizeH = (frameCount / columns) * displayHeight;

  const walkInFrom = -(displayWidth + 60);
  const facingFlip = WALK_FACES_LEFT ? 1 : -1;

  // Resolve the framer-motion animation for the arrived container.
  const reactionSet = reduced ? REDUCED_REACTIONS : FULL_REACTIONS;
  let arrivedAnimate: Record<string, any>;
  let arrivedTransition: Record<string, any>;
  if (reaction && reactionSet[reaction.kind]) {
    arrivedAnimate = { opacity: 1, ...reactionSet[reaction.kind].animate };
    arrivedTransition = { duration: reactionSet[reaction.kind].duration, ease: 'easeInOut' };
  } else if (thinking) {
    arrivedAnimate = { opacity: 1, y: reduced ? 0 : [0, -3, 0] };
    arrivedTransition = { y: { duration: 0.7, repeat: Infinity, ease: 'easeInOut' }, opacity: { duration: t.motion.base } };
  } else if (tourPlaying) {
    // Keep him completely still during the tour (no strolling/moving, no floating/jittering)
    arrivedAnimate = { opacity: 1, x: 0, y: 0, scaleX: 1 };
    arrivedTransition = { opacity: { duration: t.motion.base } };
  } else if (strolling) {
    // Wander left, turn, wander right, return to center — walk sheet + facing flips.
    // (scaleX 1 faces left for this sheet; -1 faces right.)
    arrivedAnimate = {
      opacity: 1,
      y: 0,
      x: [0, -80, -80, 80, 80, 0],
      scaleX: [1, 1, 1, -1, -1, 1],
    };
    arrivedTransition = { duration: 4.4, times: [0, 0.32, 0.46, 0.82, 0.92, 1], ease: 'easeInOut' };
  } else if (sleepingNow) {
    arrivedAnimate = { opacity: 1, y: [0, -3, 0] };
    arrivedTransition = { y: { duration: 5, repeat: Infinity, ease: 'easeInOut' } };
  } else {
    const jitter = mood.jitter && !reduced;
    arrivedAnimate = {
      opacity: 1,
      y: [0, -(reduced ? 3 : mood.floatY), 0],
      x: jitter ? [0, -2, 2, -1, 1, 0] : 0,
    };
    arrivedTransition = {
      opacity: { duration: t.motion.base },
      y: { duration: mood.floatDur, repeat: Infinity, ease: 'easeInOut' },
      x: jitter ? { duration: 0.5, repeat: Infinity, ease: 'linear' } : { duration: 0 },
    };
  }

  const worn = findAccessory(accessory ?? 'none');

  const sprite = (
    <div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={handleHover}
      title={phase === 'arrived' && !tourPlaying ? 'Click for a tip · double-click to review your prompt' : undefined}
      aria-hidden="true"
      style={{
        position: 'relative',
        width: displayWidth,
        height: displayHeight,
        flexShrink: 0,
        cursor: phase === 'arrived' && !tourPlaying ? 'pointer' : 'default',
        userSelect: 'none',
        backgroundImage: spriteUrl ? `url('${spriteUrl}')` : 'none',
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${bgSizeW}px ${bgSizeH}px`,
        backgroundPosition: `${bgPosX}px ${bgPosY}px`,
        imageRendering: 'pixelated',
        filter: phase === 'arrived' ? mood.tint : 'none',
        transition: 'filter 0.6s ease',
        // Mirror the walk sprite so it faces the way it's moving.
        transform: phase === 'walking' ? `scaleX(${facingFlip})` : undefined,
      }}
    >
      {worn.emoji && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: worn.top,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: worn.size,
            lineHeight: 1,
            pointerEvents: 'none',
            // Counter-mirror so the accessory stays upright while walking.
            ...(phase === 'walking' ? { transform: `translateX(-50%) scaleX(${facingFlip})` } : {}),
          }}
        >
          {worn.emoji}
        </span>
      )}
    </div>
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        marginTop: t.space.sm,
        overflow: 'hidden',
        position: 'relative',
        padding: `${t.space.sm}px ${t.space.sm}px 0`,
        boxSizing: 'border-box',
      }}
    >
      {/* Speech bubble */}
      <div style={{ minHeight: 44, display: 'flex', alignItems: 'flex-end', marginBottom: t.space.sm, zIndex: 2 }}>
        <AnimatePresence mode="wait">
          {bubbleVisible && (
            <motion.div
              key={bubbleText}
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: 12, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: -12 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              style={{
                background: t.color.accentBg,
                color: t.color.accentFg,
                padding: '8px 12px',
                borderRadius: '12px 12px 12px 3px',
                fontSize: t.font.size.md,
                fontWeight: t.font.weight.medium,
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                position: 'relative',
                maxWidth: 220,
                textAlign: 'center',
                lineHeight: 1.4,
              }}
            >
              {bubbleText}
              <div
                style={{
                  position: 'absolute',
                  bottom: -6,
                  left: 8,
                  borderWidth: '6px 6px 0 0',
                  borderStyle: 'solid',
                  borderColor: `${t.color.accentBg} transparent transparent transparent`,
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 320,
          height: displayHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
        }}
      >
        {phase === 'walking' ? (
          // Walk in from the left edge to center, then settle.
          <motion.div
            initial={{ x: reduced ? 0 : walkInFrom, opacity: reduced ? 0 : 1 }}
            animate={{ x: 0, opacity: 1 }}
            transition={reduced ? { duration: t.motion.slow } : { duration: 4.5, ease: 'easeInOut' }}
            onAnimationComplete={() => setPhase('arrived')}
            style={{ position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {sprite}
          </motion.div>
        ) : (
          // Arrived: resting / reacting loop driven by the state machine.
          <motion.div
            initial={{ opacity: 0 }}
            animate={arrivedAnimate}
            transition={arrivedTransition}
            style={{ position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {sprite}
          </motion.div>
        )}
      </div>

      {/* Courier overlay: a fixed-position Genouk that runs to a button and presses it. */}
      {courier.visible && (
        <motion.div
          animate={courierControls}
          initial={{ opacity: 0, x: -courierSize, y: 110 }}
          style={{ position: 'fixed', left: 0, top: 0, width: courierSize, height: courierSize, zIndex: 9998, pointerEvents: 'none' }}
        >
          <div
            style={{
              width: courierSize,
              height: courierSize,
              backgroundImage: (courier.sheet === 'walk' ? walkSpriteUrl : waveSpriteUrl)
                ? `url('${courier.sheet === 'walk' ? walkSpriteUrl : waveSpriteUrl}')`
                : 'none',
              backgroundRepeat: 'no-repeat',
              backgroundSize: `${courierBgW}px ${courierBgH}px`,
              backgroundPosition: `${-((courierFrame % columns) * courierSize)}px ${-(Math.floor(courierFrame / columns) * courierSize)}px`,
              imageRendering: 'pixelated',
              filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.35))',
            }}
          />
        </motion.div>
      )}
    </div>
  );
};
