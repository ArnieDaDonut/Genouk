import React from 'react';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { t, scoreColor } from './theme';

/** A plain content surface with a subtle border. Replaces the old neon "jarvis-card". */
export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: t.color.surface,
        border: `1px solid ${t.color.border}`,
        borderRadius: t.radius.md,
        padding: t.space.md,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Small uppercase metadata label — quiet, consistent, no glow. */
export function Label({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      style={{
        fontSize: t.font.size.xs,
        fontWeight: t.font.weight.semibold,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        color: color ?? t.color.muted,
      }}
    >
      {children}
    </span>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  busy,
  style,
  id,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  style?: React.CSSProperties;
  /** Optional DOM id — lets the Genouk courier locate this button to "press" it. */
  id?: string;
}) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      id={id}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: t.space.sm,
        background: disabled ? t.color.surface : hover ? t.color.accentBgHover : t.color.accentBg,
        color: disabled ? t.color.muted : t.color.accentFg,
        border: 'none',
        borderRadius: t.radius.sm,
        padding: '8px 12px',
        fontSize: t.font.size.md,
        fontWeight: t.font.weight.semibold,
        fontFamily: t.font.ui,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: `background ${t.motion.fast}s ease`,
        ...style,
      }}
    >
      {busy && <Loader2 size={14} style={{ animation: 'genouk-spin 0.9s linear infinite' }} />}
      {children}
    </button>
  );
}

/** Quiet secondary button (border only). */
export function GhostButton({
  children,
  onClick,
  active,
  disabled,
  title,
  style,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  style?: React.CSSProperties;
}) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: t.space.xs,
        background: disabled ? 'transparent' : hover || active ? t.color.surfaceHover : 'transparent',
        color: disabled ? t.color.muted : active ? t.color.accent : t.color.fg,
        border: `1px solid ${disabled ? t.color.border : t.color.border}`,
        borderRadius: t.radius.sm,
        padding: '4px 8px',
        fontSize: t.font.size.sm,
        fontFamily: t.font.ui,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: `background ${t.motion.fast}s ease`,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function ScoreBar({ score }: { score: number }) {
  const color = scoreColor(score);
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: t.space.xs }}>
        <Label>Prompt score</Label>
        <span style={{ fontSize: t.font.size.lg, fontWeight: t.font.weight.semibold, color }}>
          {clamped}
          <span style={{ fontSize: t.font.size.sm, color: t.color.muted, fontWeight: t.font.weight.normal }}>/100</span>
        </span>
      </div>
      <div style={{ background: t.color.surfaceHover, borderRadius: 999, height: 6, overflow: 'hidden' }}>
        <div
          style={{
            width: `${clamped}%`,
            background: color,
            height: '100%',
            borderRadius: 999,
            transition: `width ${t.motion.slow}s ease`,
          }}
        />
      </div>
    </div>
  );
}

/** Animate a number counting up to `value` over `duration` ms. */
function useCountUp(value: number, duration = 800): number {
  const [display, setDisplay] = React.useState(0);
  React.useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      const p = Math.min(1, elapsed / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return display;
}

/**
 * Animated radial score gauge. The ring fills to the score on mount and the
 * number counts up, color-coded green/yellow/red. Drop-in fun replacement for the
 * flat ScoreBar in result panels.
 */
export function ScoreRing({ score, size = 104, label = 'Prompt score' }: { score: number; size?: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, score));
  const color = scoreColor(clamped);
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const display = useCountUp(clamped);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: t.space.xs }}>
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        style={{ position: 'relative', width: size, height: size }}
      >
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.color.surfaceHover} strokeWidth={stroke} />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: c * (1 - clamped / 100) }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}
        >
          <span style={{ fontSize: 28, fontWeight: t.font.weight.semibold, color }}>{display}</span>
          <span style={{ fontSize: t.font.size.xs, color: t.color.muted, marginTop: 2 }}>/ 100</span>
        </div>
      </motion.div>
      <Label>{label}</Label>
    </div>
  );
}

export function TokenBadge({ count, label }: { count: number; label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: t.space.xs,
        background: t.color.surfaceHover,
        border: `1px solid ${t.color.border}`,
        color: t.color.fg,
        borderRadius: t.radius.sm,
        padding: '2px 8px',
        fontSize: t.font.size.sm,
        fontFamily: t.font.mono,
      }}
    >
      <span style={{ color: t.color.muted }}>{label}</span>
      <strong>{count}</strong>
    </span>
  );
}

/** First-class loading row: a labelled spinner, not just a button caption. */
export function LoadingRow({ label }: { label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: t.space.sm,
        color: t.color.muted,
        fontSize: t.font.size.md,
        padding: `${t.space.md}px ${t.space.sm}px`,
      }}
    >
      <Loader2 size={16} style={{ animation: 'genouk-spin 0.9s linear infinite', color: t.color.accent }} />
      {label}
    </div>
  );
}

/** First-class empty state. */
export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: t.space.lg, textAlign: 'center', color: t.color.muted, fontSize: t.font.size.base, lineHeight: 1.5 }}>
      {children}
    </div>
  );
}
