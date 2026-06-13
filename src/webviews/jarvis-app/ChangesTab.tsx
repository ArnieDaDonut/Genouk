import React from 'react';
import { Search, AlertOctagon, AlertTriangle, Info } from 'lucide-react';
import { t } from './theme';
import { Card, Label, PrimaryButton, LoadingRow } from './ui';

interface Props {
  changeReview: string;
  loading: boolean;
  onReview: () => void;
}

type Severity = 'blocker' | 'warning' | 'nit';
interface Finding { severity: Severity; text: string; }

const SEV = {
  blocker: { label: 'Blocker', color: t.color.bad, Icon: AlertOctagon },
  warning: { label: 'Warning', color: t.color.warn, Icon: AlertTriangle },
  nit: { label: 'Nit', color: t.color.info, Icon: Info },
} as const;

/**
 * The change reviewer returns plain text shaped as `INTENT: …` followed by
 * `BLOCKER/WARNING/NIT:` lines. We parse that into intent + ranked findings so it
 * renders as scannable badges. If the model didn't follow the format, we fall
 * back to showing the raw text.
 */
function parseReview(raw: string): { intent: string; findings: Finding[]; raw: string } {
  const lines = raw.split('\n');
  let intent = '';
  const findings: Finding[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const intentMatch = /^INTENT:\s*(.*)/i.exec(trimmed);
    if (intentMatch) { intent = intentMatch[1].trim(); continue; }
    const m = /^(BLOCKER|WARNING|NIT)[:\-]\s*(.*)/i.exec(trimmed);
    if (m) {
      findings.push({ severity: m[1].toLowerCase() as Severity, text: m[2].trim() });
    } else if (trimmed && intent) {
      // continuation of the previous finding's wrapped line
      if (findings.length) findings[findings.length - 1].text += ' ' + trimmed;
    }
  }

  const order: Severity[] = ['blocker', 'warning', 'nit'];
  findings.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));

  return { intent, findings, raw };
}

function FindingRow({ finding }: { finding: Finding }) {
  const meta = SEV[finding.severity];
  const { Icon } = meta;
  // Split "file — problem → fix" into a fix tail if present.
  const arrowIdx = finding.text.indexOf('→');
  const body = arrowIdx >= 0 ? finding.text.slice(0, arrowIdx).trim() : finding.text;
  const fix = arrowIdx >= 0 ? finding.text.slice(arrowIdx + 1).trim() : '';

  return (
    <div style={{ display: 'flex', gap: t.space.sm, padding: `${t.space.sm}px 0`, borderTop: `1px solid ${t.color.border}` }}>
      <Icon size={15} style={{ color: meta.color, flexShrink: 0, marginTop: 2 }} />
      <div style={{ minWidth: 0 }}>
        <span
          style={{
            fontSize: t.font.size.xs,
            fontWeight: t.font.weight.semibold,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            color: meta.color,
            marginRight: t.space.sm,
          }}
        >
          {meta.label}
        </span>
        <span style={{ fontSize: t.font.size.md, lineHeight: 1.5, color: t.color.fg }}>{body}</span>
        {fix && (
          <div style={{ marginTop: 4, fontSize: t.font.size.base, color: t.color.muted, lineHeight: 1.5 }}>
            <span style={{ color: t.color.good }}>Fix:</span> {fix}
          </div>
        )}
      </div>
    </div>
  );
}

export const ChangesTab: React.FC<Props> = ({ changeReview, loading, onReview }) => {
  const parsed = changeReview ? parseReview(changeReview) : null;
  const structured = parsed && parsed.findings.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: t.space.md }}>
      <Card>
        <Label>Review uncommitted changes</Label>
        <p style={{ margin: '4px 0 10px', fontSize: t.font.size.base, color: t.color.muted, lineHeight: 1.4 }}>
          Reviews your working-tree diff against HEAD and ranks findings by severity.
        </p>
        <PrimaryButton onClick={onReview} disabled={loading} busy={loading}>
          {!loading && <Search size={14} />}
          {loading ? 'Reviewing diff…' : 'Review changes'}
        </PrimaryButton>
      </Card>

      {loading && <Card><LoadingRow label="Reading the diff and reviewing…" /></Card>}

      {changeReview && !loading && (
        <Card>
          {structured ? (
            <>
              {parsed!.intent && (
                <div style={{ marginBottom: t.space.sm }}>
                  <Label color={t.color.accent}>What this change does</Label>
                  <p style={{ margin: '4px 0 0', fontSize: t.font.size.md, lineHeight: 1.5, color: t.color.fg }}>{parsed!.intent}</p>
                </div>
              )}
              <Label>{parsed!.findings.length} finding{parsed!.findings.length === 1 ? '' : 's'}</Label>
              <div style={{ marginTop: t.space.xs }}>
                {parsed!.findings.map((f, i) => <FindingRow key={i} finding={f} />)}
              </div>
            </>
          ) : (
            <>
              <Label color={t.color.accent}>Review</Label>
              <div
                style={{
                  margin: '6px 0 0',
                  fontSize: t.font.size.md,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  lineHeight: 1.55,
                  color: t.color.fg,
                }}
              >
                {changeReview}
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
};
