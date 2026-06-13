import React, { useState, useEffect, useRef } from 'react';
import { Compass, RefreshCw, FileCode, ChevronDown, ChevronRight, Sparkles, Layers, Play, Square } from 'lucide-react';
import { t } from './theme';
import { Card, Label, PrimaryButton, GhostButton, LoadingRow } from './ui';
import { CodebaseTour, TourStop } from './types';

interface Props {
  tour: CodebaseTour | null;
  loading: boolean;
  onGenerate: (description: string) => void;
  onReset: () => void;
  onOpenFile: (file: string) => void;
  /** Live-tour playback state + controls. */
  playing: boolean;
  activeStop: number | null;
  onPlay: () => void;
  onStop: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: t.color.inputBg,
  color: t.color.inputFg,
  border: `1px solid ${t.color.inputBorder}`,
  borderRadius: t.radius.sm,
  padding: '8px 10px',
  fontSize: t.font.size.md,
  fontFamily: t.font.ui,
  outline: 'none',
};

/** A clickable file-path chip that opens the file in the editor. */
const FileChip: React.FC<{ file: string; onOpen: (f: string) => void; primary?: boolean }> = ({ file, onOpen, primary }) => (
  <button
    onClick={() => onOpen(file)}
    title={`Open ${file}`}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: primary ? t.color.accentBg : t.color.surfaceHover,
      color: primary ? t.color.accentFg : t.color.fg,
      border: `1px solid ${primary ? 'transparent' : t.color.border}`,
      borderRadius: t.radius.sm, padding: '2px 7px',
      fontSize: t.font.size.xs, fontFamily: t.font.mono,
      cursor: 'pointer', maxWidth: '100%',
    }}
  >
    <FileCode size={11} style={{ flexShrink: 0 }} />
    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file}</span>
  </button>
);

const StopRow: React.FC<{ stop: TourStop; index: number; onOpenFile: (f: string) => void; active: boolean }> = ({ stop, index, onOpenFile, active }) => {
  const [open, setOpen] = useState(index === 0);
  const ref = useRef<HTMLDivElement>(null);

  // While the live tour is on this stop, force it open.
  useEffect(() => {
    if (active) {
      setOpen(true);
    }
  }, [active]);

  return (
    <div ref={ref} style={{ border: `1px solid ${active ? t.color.accent : t.color.border}`, borderRadius: t.radius.sm, overflow: 'hidden', boxShadow: active ? `0 0 0 1px ${t.color.accent}` : 'none', transition: 'border-color 0.2s ease' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: t.space.sm,
          background: open || active ? t.color.surfaceHover : 'transparent', border: 'none',
          padding: t.space.sm, cursor: 'pointer', textAlign: 'left', color: t.color.fg,
        }}
      >
        <span style={{
          flexShrink: 0, width: 20, height: 20, borderRadius: 999, background: t.color.accentBg, color: t.color.accentFg,
          fontSize: t.font.size.xs, fontWeight: t.font.weight.semibold, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {index + 1}
        </span>
        <span style={{ flex: 1, minWidth: 0, fontWeight: t.font.weight.semibold, fontSize: t.font.size.md }}>{stop.title}</span>
        {open ? <ChevronDown size={15} style={{ color: t.color.muted }} /> : <ChevronRight size={15} style={{ color: t.color.muted }} />}
      </button>

      {open && (
        <div style={{ padding: `0 ${t.space.sm}px ${t.space.sm}px`, display: 'flex', flexDirection: 'column', gap: t.space.sm }}>
          <div style={{ display: 'flex', gap: t.space.xs, flexWrap: 'wrap', alignItems: 'center' }}>
            {stop.file && <FileChip file={stop.file} onOpen={onOpenFile} primary />}
            {stop.symbol && (
              <span style={{ fontSize: t.font.size.xs, fontFamily: t.font.mono, color: t.color.muted }}>
                → {stop.symbol}
              </span>
            )}
            {stop.relatedFiles?.map((f) => <FileChip key={f} file={f} onOpen={onOpenFile} />)}
          </div>
          <div>
            <Label color={t.color.accent}>What it does</Label>
            <p style={{ margin: '3px 0 0', fontSize: t.font.size.md, lineHeight: 1.5, color: t.color.fg }}>{stop.what}</p>
          </div>
          <div>
            <Label>How it works</Label>
            <p style={{ margin: '3px 0 0', fontSize: t.font.size.base, lineHeight: 1.55, color: t.color.muted }}>{stop.how}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export const TourTab: React.FC<Props> = ({ tour, loading, onGenerate, onReset, onOpenFile, playing, activeStop, onPlay, onStop }) => {
  const [description, setDescription] = useState('');

  if (loading) {
    return <Card><LoadingRow label="Exploring the codebase and writing your tour…" /></Card>;
  }

  if (!tour) {
    return (
      <Card>
        <Label>Tour this codebase</Label>
        <p style={{ margin: '4px 0 10px', fontSize: t.font.size.base, color: t.color.muted, lineHeight: 1.45 }}>
          Genouk reads the project and walks you through its architecture, main features, and where
          everything lives. Optionally tell it what the program is meant to do — otherwise it figures that out.
        </p>
        <Label>What does this program do? <span style={{ textTransform: 'none', fontWeight: t.font.weight.normal, color: t.color.muted }}>(optional)</span></Label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. A VS Code extension that reviews prompts and plans coding sessions…"
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5, marginTop: 4 }}
        />
        <PrimaryButton onClick={() => onGenerate(description)} style={{ marginTop: t.space.sm }}>
          <Compass size={14} /> Start tour
        </PrimaryButton>
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: t.space.md }}>
      <Card style={{ display: 'flex', flexDirection: 'column', gap: t.space.sm }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: t.space.sm }}>
          <Label color={t.color.accent}>{tour.inferred ? 'Inferred purpose' : 'What this program does'}</Label>
          <div style={{ display: 'flex', gap: t.space.xs, flexShrink: 0 }}>
            {playing ? (
              <GhostButton onClick={onStop} title="Stop the live tour">
                <Square size={11} fill="currentColor" /> Stop
              </GhostButton>
            ) : (
              <GhostButton onClick={onPlay} title="Genouk walks you through each stop">
                <Play size={11} fill="currentColor" /> Live tour
              </GhostButton>
            )}
            <GhostButton onClick={onReset} title="Start a new tour">
              <RefreshCw size={12} /> Retour
            </GhostButton>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: t.font.size.md, lineHeight: 1.5, color: t.color.fg }}>{tour.summary}</p>
        {tour.inferred && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: t.font.size.xs, color: t.color.muted }}>
            <Sparkles size={11} /> Genouk inferred this — give it a description for a sharper tour.
          </span>
        )}
        {tour.techStack?.length > 0 && (
          <div style={{ display: 'flex', gap: t.space.xs, flexWrap: 'wrap', marginTop: 2 }}>
            {tour.techStack.map((tech) => (
              <span key={tech} style={{ fontSize: t.font.size.xs, fontFamily: t.font.mono, color: t.color.muted, background: t.color.surfaceHover, border: `1px solid ${t.color.border}`, borderRadius: t.radius.sm, padding: '1px 6px' }}>
                {tech}
              </span>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: t.space.xs, marginBottom: t.space.xs }}>
          <Layers size={13} style={{ color: t.color.accent }} />
          <Label>Architecture</Label>
        </div>
        <p style={{ margin: 0, fontSize: t.font.size.md, lineHeight: 1.55, color: t.color.fg }}>{tour.architecture}</p>
      </Card>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Label>Walkthrough · {tour.stops.length} stop{tour.stops.length === 1 ? '' : 's'}</Label>
          {playing && activeStop !== null && (
            <span style={{ fontSize: t.font.size.xs, color: t.color.accent, fontFamily: t.font.mono }}>
              ▶ {activeStop + 1}/{tour.stops.length}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: t.space.sm, marginTop: t.space.xs }}>
          {tour.stops.map((stop, i) => (
            <StopRow key={i} stop={stop} index={i} onOpenFile={onOpenFile} active={playing && activeStop === i} />
          ))}
        </div>
      </div>
    </div>
  );
};
