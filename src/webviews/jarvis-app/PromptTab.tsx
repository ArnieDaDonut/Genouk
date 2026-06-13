import React, { useRef, useState } from 'react';
import { Zap, Copy, Check, ArrowUp, Lightbulb } from 'lucide-react';
import { t } from './theme';
import { Card, Label, PrimaryButton, GhostButton, ScoreRing, TokenBadge, LoadingRow } from './ui';
import { PromptReviewResult, estimateTokens } from './types';

interface Props {
  prompt: string;
  setPrompt: (v: string) => void;
  review: PromptReviewResult | null;
  setReview: (v: PromptReviewResult | null) => void;
  loading: boolean;
  onReview: () => void;
}

export const PromptTab: React.FC<Props> = ({ prompt, setPrompt, review, setReview, loading, onReview }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);

  const liveTokens = estimateTokens(prompt);
  // Count from the actual text shown, not the model's self-estimate — the model's
  // numbers drifted from what it actually produced.
  const originalTokens = estimateTokens(prompt);
  const rewrittenTokens = review ? estimateTokens(review.improvedPrompt) : 0;
  const delta = rewrittenTokens - originalTokens; // <0 fewer, >0 more detail
  const deltaPct = originalTokens > 0 ? Math.round((Math.abs(delta) / originalTokens) * 100) : 0;

  const handleCopy = () => {
    if (!review) return;
    navigator.clipboard?.writeText(review.improvedPrompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleUseImproved = () => {
    if (!review) return;
    setPrompt(review.improvedPrompt);
    setReview(null);
    textareaRef.current?.focus();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: t.space.md }}>
      <Card>
        <div style={{ marginBottom: t.space.sm }}>
          <Label>Review a prompt</Label>
          <p style={{ margin: '4px 0 0', fontSize: t.font.size.base, color: t.color.muted, lineHeight: 1.4 }}>
            Genouk reads your repo, judges the prompt against what you're likely trying to do, and rewrites it.
          </p>
        </div>

        <div style={{ position: 'relative' }}>
          <textarea
            ref={textareaRef}
            rows={6}
            value={prompt}
            onChange={(e) => { setPrompt(e.target.value); setReview(null); }}
            placeholder="Paste the prompt you're about to send to a coding LLM…"
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onReview(); }}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              resize: 'vertical',
              background: t.color.inputBg,
              color: t.color.inputFg,
              border: `1px solid ${t.color.inputBorder}`,
              borderRadius: t.radius.sm,
              padding: '8px 10px',
              fontSize: t.font.size.md,
              fontFamily: t.font.ui,
              lineHeight: 1.5,
              outline: 'none',
            }}
          />
          {prompt && (
            <div style={{ position: 'absolute', bottom: 8, right: 10, fontSize: t.font.size.xs, fontFamily: t.font.mono, color: t.color.muted }}>
              ~{liveTokens} tokens
            </div>
          )}
        </div>

        <PrimaryButton id="genouk-btn-reviewPrompt" onClick={onReview} disabled={loading || !prompt.trim()} busy={loading} style={{ marginTop: t.space.sm }}>
          {!loading && <Zap size={14} />}
          {loading ? 'Reviewing…' : 'Review prompt'}
          {!loading && <span style={{ fontWeight: 400, opacity: 0.7, fontSize: t.font.size.sm }}>⌘↵</span>}
        </PrimaryButton>
      </Card>

      {loading && <Card><LoadingRow label="Reading repo and reviewing your prompt…" /></Card>}

      {review && !loading && (
        <Card style={{ display: 'flex', flexDirection: 'column', gap: t.space.md }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: t.space.lg }}>
            <ScoreRing score={review.score} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: t.space.sm, flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: t.space.xs, flexWrap: 'wrap', alignItems: 'center' }}>
                <TokenBadge count={originalTokens} label="Original" />
                <span style={{ color: t.color.muted }}>→</span>
                <TokenBadge count={rewrittenTokens} label="Rewritten" />
              </div>
              {delta !== 0 && (
                <span style={{ fontSize: t.font.size.sm, color: delta < 0 ? t.color.good : t.color.muted, fontWeight: t.font.weight.semibold }}>
                  {delta < 0 ? `−${Math.abs(delta)} tokens (${deltaPct}% leaner)` : `+${delta} tokens of added detail`}
                </span>
              )}
            </div>
          </div>

          <div>
            <Label color={t.color.fg}>Critique</Label>
            <p style={{ margin: '6px 0 0', fontSize: t.font.size.md, lineHeight: 1.55, color: t.color.fg }}>{review.feedback}</p>
          </div>

          {review.tokenIssues?.length > 0 && (
            <div>
              <Label color={t.color.warn}>Weaknesses found</Label>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: t.font.size.base, lineHeight: 1.6, color: t.color.fg }}>
                {review.tokenIssues.map((issue, i) => (
                  <li key={i} style={{ marginBottom: 2 }}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: t.space.sm }}>
              <Label color={t.color.accent}>Rewritten prompt</Label>
              <div style={{ display: 'flex', gap: t.space.xs }}>
                <GhostButton onClick={handleCopy} title="Copy to clipboard">
                  {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                </GhostButton>
                <GhostButton onClick={handleUseImproved} active title="Replace the input with this">
                  <ArrowUp size={12} /> Use this
                </GhostButton>
              </div>
            </div>
            <pre
              style={{
                margin: 0,
                padding: 10,
                borderRadius: t.radius.sm,
                fontSize: t.font.size.base,
                background: t.color.inputBg,
                border: `1px solid ${t.color.border}`,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: 1.5,
                fontFamily: t.font.mono,
                color: t.color.fg,
              }}
            >
              {review.improvedPrompt}
            </pre>
          </div>

          {review.suggestions && review.suggestions.length > 0 && (
            <div
              style={{
                borderTop: `1px solid ${t.color.border}`,
                paddingTop: t.space.md,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: t.space.xs, marginBottom: t.space.sm }}>
                <Lightbulb size={13} style={{ color: t.color.warn }} />
                <Label color={t.color.warn}>Suggestions to consider</Label>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: t.font.size.base, lineHeight: 1.6, color: t.color.fg }}>
                {review.suggestions.map((s, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
