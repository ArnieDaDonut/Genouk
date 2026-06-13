import React from 'react';
import { t, scoreColor } from './theme';
import { VibeState } from './types';

/**
 * Honest replacement for the old holographic "GRID SYSTEM SECURE" canvas. Shows
 * the file Genouk is watching and its live diagnostics in plain language. Renders
 * nothing when there is no active file to report on.
 */
export const EditorHealth: React.FC<{ vibe: VibeState }> = ({ vibe }) => {
  if (!vibe.fileName || vibe.score === null) return null;
  const color = scoreColor(vibe.score);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: t.space.sm,
        padding: `6px ${t.space.sm}px`,
        marginBottom: t.space.md,
        background: t.color.surface,
        border: `1px solid ${t.color.border}`,
        borderRadius: t.radius.sm,
        fontSize: t.font.size.sm,
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span
        style={{
          color: t.color.muted,
          fontFamily: t.font.mono,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          flex: 1,
          minWidth: 0,
        }}
        title={vibe.fileName}
      >
        {vibe.fileName}
      </span>
      <span style={{ color: vibe.errorsCount > 0 ? t.color.bad : t.color.muted }}>
        {vibe.errorsCount} err
      </span>
      <span style={{ color: vibe.warningsCount > 0 ? t.color.warn : t.color.muted }}>
        {vibe.warningsCount} warn
      </span>
      <span style={{ color, fontWeight: t.font.weight.semibold }}>{vibe.score}</span>
    </div>
  );
};
