import React from 'react';
import { Brain, FileText, FileJson, Copy, RefreshCw, Trash2, ChevronRight, ChevronDown, Check, Pin } from 'lucide-react';
import { t } from './theme';
import { Card, Label, PrimaryButton, GhostButton, EmptyState, LoadingRow } from './ui';
import { MemoryData, SessionDigest, Fact } from './types';

interface Props {
  data: MemoryData | null;
  loading: boolean;
  onWriteConfig: () => void;
  onCopyConfig: () => void;
  onRefresh: () => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const s = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d}d ago`;
}

/**
 * Cross-chat memory. Carry-over now rides on a plain-text block Genouk keeps in the
 * repo's CLAUDE.md — which Claude Code, Cursor, and other agents auto-load every chat,
 * so a fresh session already knows where the last one left off, with zero tool calls.
 * The bundled MCP server is the (optional) write side: it lets agents save new digests.
 * This tab shows what's remembered and the carry-over status.
 */
export const MemoryTab: React.FC<Props> = ({ data, loading, onWriteConfig, onCopyConfig, onRefresh, onDelete, onClear }) => {
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [showSaveSetup, setShowSaveSetup] = React.useState(false);
  const toggle = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const synced = !!data?.memoryFileWritten;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: t.space.md }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: t.space.xs, marginBottom: t.space.xs }}>
          <Brain size={14} style={{ color: t.color.accent }} />
          <Label>Cross-chat memory</Label>
        </div>
        <p style={{ margin: '4px 0 0', fontSize: t.font.size.base, color: t.color.muted, lineHeight: 1.5 }}>
          Genouk gives every AI chat in this project a shared memory. It keeps a live summary —
          decisions, files touched, open threads — in a managed block in your{' '}
          <code style={{ fontFamily: t.font.mono, color: t.color.fg }}>CLAUDE.md</code>, which agents load
          automatically. So a brand-new chat already knows where you left off — no copy-pasting, no setup.
        </p>
      </Card>

      {/* Carry-over status — the text-file path that makes recall automatic */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: t.space.xs }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: t.space.xs }}>
            <FileText size={13} style={{ color: t.color.accent }} />
            <Label>Carry-over</Label>
          </div>
          {data?.memoryFilePath && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: t.font.size.xs,
              color: synced ? t.color.good : t.color.muted,
            }}>
              {synced ? <><Check size={11} /> CLAUDE.md synced</> : 'not synced yet'}
            </span>
          )}
        </div>
        <p style={{ margin: '4px 0 0', fontSize: t.font.size.base, color: t.color.muted, lineHeight: 1.5 }}>
          {data?.memoryFilePath
            ? <>Recall is automatic — the memory block lives in <code style={{ fontFamily: t.font.mono, color: t.color.fg }}>CLAUDE.md</code> and every agent reads it on its own. No tool call required. Genouk refreshes it whenever a session is saved.</>
            : 'Open a folder/workspace to enable cross-chat memory for a project.'}
        </p>

        {/* Saving side (MCP) — secondary, collapsed by default */}
        {data?.mcpConfigPath && (
          <div style={{ marginTop: t.space.sm }}>
            <button
              onClick={() => setShowSaveSetup((v) => !v)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4, color: t.color.muted, fontSize: t.font.size.xs }}
            >
              {showSaveSetup ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              Saving new sessions (optional MCP setup)
              {data.configWritten && <span style={{ color: t.color.good, display: 'inline-flex', alignItems: 'center', gap: 3 }}><Check size={10} /> connected</span>}
            </button>

            {showSaveSetup && (
              <div style={{ marginTop: t.space.sm }}>
                <p style={{ margin: '0 0 10px', fontSize: t.font.size.base, color: t.color.muted, lineHeight: 1.5 }}>
                  To let agents <em>write</em> new digests, wire the bundled memory server into{' '}
                  <code style={{ fontFamily: t.font.mono, color: t.color.fg }}>.mcp.json</code>. Recall above works without this.
                </p>
                {data.mcpConfig && (
                  <pre style={{
                    margin: '0 0 10px', padding: t.space.sm, background: t.color.surface,
                    border: `1px solid ${t.color.border}`, borderRadius: t.radius.sm,
                    fontFamily: t.font.mono, fontSize: t.font.size.xs, color: t.color.fg,
                    overflowX: 'auto', lineHeight: 1.45, whiteSpace: 'pre',
                  }}>{data.mcpConfig}</pre>
                )}
                <div style={{ display: 'flex', gap: t.space.sm }}>
                  <PrimaryButton onClick={onWriteConfig} disabled={!data?.mcpConfigPath} style={{ flex: 1 }}>
                    <FileJson size={14} /> Write .mcp.json
                  </PrimaryButton>
                  <GhostButton onClick={onCopyConfig} title="Copy the MCP config to the clipboard">
                    <Copy size={13} /> Copy
                  </GhostButton>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Remembered facts — the user's explicit "remember this" notes */}
      {!loading && data && data.facts.length > 0 && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: t.space.xs, marginBottom: t.space.sm }}>
            <Pin size={13} style={{ color: t.color.accent }} />
            <Label>Remembered facts ({data.facts.length})</Label>
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {data.facts.map((f: Fact) => (
              <li key={f.id} style={{ fontSize: t.font.size.base, color: t.color.fg, lineHeight: 1.45 }}>{f.text}</li>
            ))}
          </ul>
        </Card>
      )}

      {/* Remembered sessions */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: t.space.sm }}>
          <Label>Remembered sessions{data ? ` (${data.digests.length})` : ''}</Label>
          <div style={{ display: 'flex', gap: t.space.xs }}>
            <GhostButton onClick={onRefresh} title="Reload from disk"><RefreshCw size={12} /> Refresh</GhostButton>
            {data && (data.digests.length > 0 || data.facts.length > 0) && (
              <GhostButton onClick={onClear} title="Delete all remembered sessions and facts for this project"><Trash2 size={12} /> Clear</GhostButton>
            )}
          </div>
        </div>

        {loading && <LoadingRow label="Loading memory…" />}

        {!loading && (!data || data.digests.length === 0) && (
          <EmptyState>
            Nothing remembered yet. Once your agent calls <code style={{ fontFamily: t.font.mono }}>save_context</code> at
            the end of a chat, its digest shows up here and carries into your next session via CLAUDE.md.
          </EmptyState>
        )}

        {!loading && data && data.digests.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: t.space.xs }}>
            {data.digests.map((d) => (
              <DigestRow key={d.id} d={d} open={!!expanded[d.id]} onToggle={() => toggle(d.id)} onDelete={() => onDelete(d.id)} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

function DigestRow({ d, open, onToggle, onDelete }: { d: SessionDigest; open: boolean; onToggle: () => void; onDelete: () => void }) {
  return (
    <div style={{ border: `1px solid ${t.color.border}`, borderRadius: t.radius.sm, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: t.space.xs, padding: '7px 8px' }}>
        <button
          onClick={onToggle}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: t.color.muted, padding: 0, display: 'flex', flexShrink: 0 }}
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <button onClick={onToggle} style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
          <div style={{ fontSize: t.font.size.base, color: t.color.fg, fontWeight: t.font.weight.semibold, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {d.title}
          </div>
        </button>
        <span style={{ fontSize: t.font.size.xs, color: t.color.muted, fontFamily: t.font.mono, flexShrink: 0 }}>{relTime(d.ts)}</span>
        <button
          onClick={onDelete}
          title="Forget this session"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: t.color.muted, padding: 0, display: 'flex', flexShrink: 0 }}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {open && (
        <div style={{ padding: '0 10px 10px 26px', display: 'flex', flexDirection: 'column', gap: t.space.xs }}>
          <p style={{ margin: 0, fontSize: t.font.size.base, color: t.color.muted, lineHeight: 1.5 }}>{d.summary}</p>
          <DigestList title="Decisions" items={d.decisions} />
          <DigestList title="Files touched" items={d.files} mono />
          <DigestList title="Open threads" items={d.openThreads} />
        </div>
      )}
    </div>
  );
}

function DigestList({ title, items, mono }: { title: string; items: string[]; mono?: boolean }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div style={{ fontSize: t.font.size.xs, color: t.color.fg, fontWeight: t.font.weight.semibold, margin: '2px 0' }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map((it, i) => (
          <li key={i} style={{ fontSize: t.font.size.base, color: t.color.muted, fontFamily: mono ? t.font.mono : t.font.ui, lineHeight: 1.45 }}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
