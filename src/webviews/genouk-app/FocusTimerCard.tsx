import React from 'react';
import { Play, Pause, RotateCcw, SkipForward, Coffee, Brain, Target, CheckCircle2 } from 'lucide-react';
import { t } from './theme';
import { Card, Label, PrimaryButton, GhostButton } from './ui';
import { FocusTimer } from './useFocusTimer';
import { SessionTask } from './types';

interface Props {
  timer: FocusTimer;
  /** Wrapped start so the host can have Genouk announce the current task. */
  onStart: () => void;
  /** Unfinished session tasks the user can dedicate this block to. */
  tasks: SessionTask[];
  /** The task this focus block is bound to (always one of `tasks`, or null). */
  focusTask: SessionTask | null;
  onSelectTask: (id: string) => void;
  /** Set after a focus block ends: the task to offer checking off. */
  pendingComplete: SessionTask | null;
  onComplete: (id: string) => void;
  onDismissComplete: () => void;
}

function fmt(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const FocusTimerCard: React.FC<Props> = ({
  timer,
  onStart,
  tasks,
  focusTask,
  onSelectTask,
  pendingComplete,
  onComplete,
  onDismissComplete,
}) => {
  const { running, phase, secondsLeft, totalSeconds, focusMinutes, breakMinutes } = timer;
  const isBreak = phase === 'break';
  const accent = isBreak ? t.color.good : t.color.info;
  const pct = totalSeconds > 0 ? Math.min(100, ((totalSeconds - secondsLeft) / totalSeconds) * 100) : 0;

  const numberInput: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    background: t.color.inputBg,
    color: t.color.inputFg,
    border: `1px solid ${t.color.inputBorder}`,
    borderRadius: t.radius.sm,
    padding: '6px 8px',
    fontSize: t.font.size.md,
    fontFamily: t.font.ui,
    outline: 'none',
  };

  const completeBox: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: t.space.sm,
    background: t.color.surfaceHover,
    border: `1px solid ${t.color.border}`,
    borderRadius: t.radius.sm,
    padding: t.space.sm,
  };

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: t.space.md }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Label color={accent}>Focus timer</Label>
        <span
          style={{
            display: 'inline-flex', alignItems: 'center', gap: t.space.xs,
            fontSize: t.font.size.xs, fontWeight: t.font.weight.semibold,
            textTransform: 'uppercase', letterSpacing: 0.6, color: accent,
            background: t.color.surfaceHover, border: `1px solid ${t.color.border}`,
            borderRadius: 999, padding: '2px 8px',
          }}
        >
          {isBreak ? <Coffee size={11} /> : <Brain size={11} />}
          {isBreak ? 'Break' : 'Focus'}
        </span>
      </div>

      {/* Task binding: which session task this block is for, and the post-block
          "mark it done?" prompt once a focus block ends. */}
      {pendingComplete ? (
        <div style={completeBox}>
          <div style={{ display: 'flex', alignItems: 'center', gap: t.space.xs, fontSize: t.font.size.base, color: t.color.fg }}>
            <CheckCircle2 size={14} style={{ color: t.color.good, flexShrink: 0 }} />
            <span>Finish <strong>{pendingComplete.title}</strong>?</span>
          </div>
          <div style={{ display: 'flex', gap: t.space.sm }}>
            <PrimaryButton onClick={() => onComplete(pendingComplete.id)} style={{ flex: 1 }}>
              <CheckCircle2 size={14} /> Mark done
            </PrimaryButton>
            <GhostButton onClick={onDismissComplete} title="Keep working on it">Not yet</GhostButton>
          </div>
        </div>
      ) : focusTask ? (
        <label style={{ display: 'block' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: t.space.xs, fontSize: t.font.size.xs, color: t.color.muted, marginBottom: 4 }}>
            <Target size={11} /> Focusing on
          </span>
          <select value={focusTask.id} onChange={(e) => onSelectTask(e.target.value)} style={numberInput}>
            {tasks.map((tk) => (
              <option key={tk.id} value={tk.id}>{tk.title}</option>
            ))}
          </select>
        </label>
      ) : (
        <div style={{ fontSize: t.font.size.xs, color: t.color.muted, display: 'flex', alignItems: 'center', gap: t.space.xs }}>
          <Target size={11} /> Generate a session plan to focus on a task.
        </div>
      )}

      <div style={{ textAlign: 'center' }}>
        <span style={{ fontSize: 40, fontWeight: t.font.weight.semibold, fontFamily: t.font.mono, color: t.color.fg, letterSpacing: 1 }}>
          {fmt(secondsLeft)}
        </span>
      </div>

      <div style={{ background: t.color.surfaceHover, borderRadius: 999, height: 6, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, background: accent, height: '100%', borderRadius: 999, transition: 'width 0.9s linear' }} />
      </div>

      <div style={{ display: 'flex', gap: t.space.sm }}>
        <PrimaryButton onClick={running ? timer.pause : onStart} style={{ flex: 1 }}>
          {running ? <><Pause size={14} /> Pause</> : <><Play size={14} fill="currentColor" /> Start</>}
        </PrimaryButton>
        <GhostButton onClick={timer.reset} title="Reset to a fresh focus block">
          <RotateCcw size={13} />
        </GhostButton>
        <GhostButton onClick={timer.skip} title={isBreak ? 'Skip break' : 'Skip to break'}>
          <SkipForward size={13} />
        </GhostButton>
      </div>

      {!running && (
        <div style={{ display: 'flex', gap: t.space.sm }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: t.font.size.xs, color: t.color.muted, display: 'block', marginBottom: 2 }}>Focus (min)</span>
            <input
              type="number"
              min={1}
              max={180}
              value={focusMinutes}
              onChange={(e) => timer.setFocusMinutes(parseInt(e.target.value) || 1)}
              style={numberInput}
            />
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: t.font.size.xs, color: t.color.muted, display: 'block', marginBottom: 2 }}>Break (min)</span>
            <input
              type="number"
              min={1}
              max={60}
              value={breakMinutes}
              onChange={(e) => timer.setBreakMinutes(parseInt(e.target.value) || 1)}
              style={numberInput}
            />
          </div>
        </div>
      )}
    </Card>
  );
};
