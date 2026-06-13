import React from 'react';
import { Volume2, VolumeX, Music, Play } from 'lucide-react';
import { t } from './theme';
import { Card, Label } from './ui';
import { VibeState } from './types';
import { MusicCue, MusicTier } from './musicEngine';

interface Props {
  volume: number;
  setVolume: (v: number) => void;
  muted: boolean;
  setMuted: (v: boolean) => void;
  vibe: VibeState;
  musicCue: MusicCue | null;
  onPreviewTier: (tier: MusicTier) => void;
}

const TIERS: { tier: MusicTier; label: string; range: string; color: string }[] = [
  { tier: 'triumphant', label: 'Triumphant', range: '80–96', color: t.color.good },
  { tier: 'good', label: 'Warm', range: '60–79', color: t.color.accent },
  { tier: 'uneasy', label: 'Uneasy', range: '40–59', color: t.color.warn },
  { tier: 'chaos', label: 'Dissonant', range: '0–39', color: t.color.bad },
];

/**
 * Sound settings. Genouk plays ambient loops that react to your editor's
 * diagnostics state — calmer when the file is clean, more urgent when errors pile
 * up. Honest copy, no "HUD BROADCAST MATRIX".
 */
export const AudioTab: React.FC<Props> = ({ volume, setVolume, muted, setMuted, vibe, musicCue, onPreviewTier }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: t.space.md }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: t.space.xs, marginBottom: t.space.xs }}>
          <Music size={14} style={{ color: t.color.accent }} />
          <Label>Score-reactive music</Label>
        </div>
        <p style={{ margin: '4px 0 12px', fontSize: t.font.size.base, color: t.color.muted, lineHeight: 1.4 }}>
          When you review a prompt, Genouk synthesizes a short phrase that matches the score —
          triumphant when it's sharp, dissonant when it's broken. Tap a tier to preview.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: t.space.xs }}>
          {TIERS.map(({ tier, label, range, color }) => {
            const active = musicCue?.tier === tier;
            return (
              <button
                key={tier}
                onClick={() => onPreviewTier(tier)}
                title={`Preview the ${label.toLowerCase()} phrase (score ${range})`}
                style={{
                  display: 'flex', alignItems: 'center', gap: t.space.xs,
                  background: active ? t.color.accentBg : 'transparent',
                  color: active ? t.color.accentFg : t.color.fg,
                  border: `1px solid ${active ? t.color.accent : t.color.border}`,
                  borderRadius: t.radius.sm, padding: '6px 8px', cursor: 'pointer',
                  fontSize: t.font.size.base, fontFamily: t.font.ui, textAlign: 'left',
                }}
              >
                <Play size={11} fill="currentColor" style={{ flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{label}</span>
                <span style={{ fontFamily: t.font.mono, fontSize: t.font.size.xs, color: active ? t.color.accentFg : color }}>{range}</span>
              </button>
            );
          })}
        </div>

        {musicCue && (
          <p style={{ margin: '10px 0 0', fontSize: t.font.size.base, color: t.color.muted, lineHeight: 1.4 }}>
            Last played: {musicCue.label}
          </p>
        )}
      </Card>

      <Card>
        <Label>Ambient sound</Label>
        <p style={{ margin: '4px 0 12px', fontSize: t.font.size.base, color: t.color.muted, lineHeight: 1.4 }}>
          Genouk plays a soft ambient loop that shifts with your editor's diagnostics.
        </p>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: t.font.size.md, marginBottom: t.space.xs }}>
          <span>Volume</span>
          <span style={{ color: t.color.muted, fontFamily: t.font.mono }}>{Math.round(volume * 100)}%</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: t.space.sm }}>
          <button
            onClick={() => setMuted(!muted)}
            title={muted ? 'Unmute' : 'Mute'}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: muted ? t.color.bad : t.color.fg, padding: 0, display: 'flex' }}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: t.color.accent, cursor: 'pointer' }}
          />
        </div>
      </Card>

      <Card>
        <Label>Editor diagnostics</Label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: t.space.xs, marginTop: t.space.sm, fontSize: t.font.size.md }}>
          <Row k="Compiler score" v={vibe.score !== null ? `${vibe.score}/100` : 'No active file'} />
          <Row k="Errors" v={String(vibe.errorsCount)} color={vibe.errorsCount > 0 ? t.color.bad : undefined} />
          <Row k="Warnings" v={String(vibe.warningsCount)} color={vibe.warningsCount > 0 ? t.color.warn : undefined} />
        </div>
      </Card>
    </div>
  );
};

function Row({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: t.color.muted }}>{k}</span>
      <span style={{ color: color ?? t.color.fg }}>{v}</span>
    </div>
  );
}
