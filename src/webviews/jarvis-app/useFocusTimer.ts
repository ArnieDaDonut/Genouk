import { useEffect, useRef, useState } from 'react';

export type FocusPhase = 'focus' | 'break';

export interface FocusTimer {
  running: boolean;
  phase: FocusPhase;
  secondsLeft: number;
  totalSeconds: number;
  focusMinutes: number;
  breakMinutes: number;
  start: () => void;
  pause: () => void;
  reset: () => void;
  skip: () => void;
  setFocusMinutes: (m: number) => void;
  setBreakMinutes: (m: number) => void;
}

const clampMinutes = (m: number) => Math.max(1, Math.min(180, Math.round(m) || 1));

/**
 * Pomodoro-style focus/break timer. Ticks down the current phase; when a phase
 * reaches zero it flips to the other phase, refills the clock, and fires
 * `onPhaseEnd(endedPhase, nextPhase)` so the host can have Genouk announce it.
 *
 * Lives in the App (not a tab) so it keeps running across tab switches.
 */
export function useFocusTimer(
  onPhaseEnd: (endedPhase: FocusPhase, nextPhase: FocusPhase) => void,
): FocusTimer {
  const [focusMinutes, setFocusMinutesState] = useState(25);
  const [breakMinutes, setBreakMinutesState] = useState(5);
  const [phase, setPhase] = useState<FocusPhase>('focus');
  const [running, setRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);

  const onPhaseEndRef = useRef(onPhaseEnd);
  useEffect(() => { onPhaseEndRef.current = onPhaseEnd; }, [onPhaseEnd]);

  // Tick once per second while running. Interval only depends on `running`, so it
  // is not torn down and rebuilt every second.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [running]);

  // React to the clock hitting zero: flip phase, refill, notify host.
  useEffect(() => {
    if (!running || secondsLeft > 0) return;
    const endedPhase = phase;
    const nextPhase: FocusPhase = endedPhase === 'focus' ? 'break' : 'focus';
    setPhase(nextPhase);
    setSecondsLeft((nextPhase === 'focus' ? focusMinutes : breakMinutes) * 60);
    onPhaseEndRef.current(endedPhase, nextPhase);
  }, [secondsLeft, running, phase, focusMinutes, breakMinutes]);

  const totalSeconds = (phase === 'focus' ? focusMinutes : breakMinutes) * 60;

  const start = () => setRunning(true);
  const pause = () => setRunning(false);

  const reset = () => {
    setRunning(false);
    setPhase('focus');
    setSecondsLeft(focusMinutes * 60);
  };

  const skip = () => {
    const nextPhase: FocusPhase = phase === 'focus' ? 'break' : 'focus';
    setPhase(nextPhase);
    setSecondsLeft((nextPhase === 'focus' ? focusMinutes : breakMinutes) * 60);
    onPhaseEndRef.current(phase, nextPhase);
  };

  const setFocusMinutes = (m: number) => {
    const v = clampMinutes(m);
    setFocusMinutesState(v);
    if (!running && phase === 'focus') setSecondsLeft(v * 60);
  };

  const setBreakMinutes = (m: number) => {
    const v = clampMinutes(m);
    setBreakMinutesState(v);
    if (!running && phase === 'break') setSecondsLeft(v * 60);
  };

  return {
    running, phase, secondsLeft, totalSeconds, focusMinutes, breakMinutes,
    start, pause, reset, skip, setFocusMinutes, setBreakMinutes,
  };
}
