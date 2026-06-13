import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

declare const window: any;
const vscode = window.acquireVsCodeApi();

// Rough token estimate: words * 1.3
function estimateTokens(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.round(words * 1.3);
}

function TokenBadge({ count, label }: { count: number; label: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: 'var(--vscode-badge-background)',
      color: 'var(--vscode-badge-foreground)',
      borderRadius: 4, padding: '2px 8px', fontSize: 11, fontFamily: 'monospace'
    }}>
      {label}: <strong>{count}</strong> tokens
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? '#4ec9b0' : score >= 50 ? '#dcdcaa' : '#f44747';
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
        <span>Prompt Score</span>
        <strong style={{ color }}>{score}/100</strong>
      </div>
      <div style={{ background: 'var(--vscode-input-background)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, background: color, height: '100%', transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

const App = () => {
  const [prompt, setPrompt] = useState('');
  const [review, setReview] = useState<any>(null);
  const [changeReview, setChangeReview] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const liveTokens = estimateTokens(prompt);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'promptReviewResult':
          setReview(message.value);
          setLoading(false);
          break;
        case 'changeReviewResult':
          setChangeReview(message.value);
          setLoading(false);
          break;
        case 'error':
          setError(message.value);
          setLoading(false);
          break;
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleReviewPrompt = () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError('');
    setReview(null);
    vscode.postMessage({ type: 'reviewPrompt', value: prompt });
  };

  const handleUseImproved = () => {
    setPrompt(review.improvedPrompt);
    setReview(null);
    textareaRef.current?.focus();
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(review.improvedPrompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleReviewChanges = () => {
    setLoading(true);
    setError('');
    setChangeReview('');
    vscode.postMessage({ type: 'reviewChanges' });
  };

  const savings = review
    ? review.estimatedOriginalTokens - review.estimatedImprovedTokens
    : 0;

  return (
    <div style={{ fontFamily: 'var(--vscode-font-family)', padding: '12px 10px', color: 'var(--vscode-foreground)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 18 }}>⚡</span>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
          Prompt Reviewer
        </h2>
      </div>

      {/* Textarea */}
      <div style={{ position: 'relative' }}>
        <textarea
          ref={textareaRef}
          rows={6}
          value={prompt}
          onChange={(e) => { setPrompt(e.target.value); setReview(null); }}
          placeholder="Type your prompt here..."
          style={{
            width: '100%', boxSizing: 'border-box', resize: 'vertical',
            background: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            border: '1px solid var(--vscode-input-border)',
            borderRadius: 4, padding: '8px 10px', fontSize: 13,
            outline: 'none', lineHeight: 1.5
          }}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleReviewPrompt(); }}
        />
        {prompt && (
          <div style={{ position: 'absolute', bottom: 8, right: 8, opacity: 0.5, fontSize: 11, fontFamily: 'monospace' }}>
            ~{liveTokens} tokens
          </div>
        )}
      </div>

      <button
        onClick={handleReviewPrompt}
        disabled={loading || !prompt.trim()}
        style={{
          marginTop: 8, width: '100%',
          background: loading ? 'var(--vscode-button-secondaryBackground)' : 'var(--vscode-button-background)',
          color: 'var(--vscode-button-foreground)',
          border: 'none', borderRadius: 4, padding: '8px 0',
          cursor: loading || !prompt.trim() ? 'not-allowed' : 'pointer',
          fontWeight: 600, fontSize: 13, letterSpacing: 0.5
        }}
      >
        {loading ? '⟳  Analyzing...' : '⚡  Review Prompt  (Ctrl+Enter)'}
      </button>

      {error && (
        <div style={{ marginTop: 12, padding: '8px 10px', borderRadius: 4, background: 'var(--vscode-inputValidation-errorBackground)', color: 'var(--vscode-errorForeground)', fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* Review Result */}
      {review && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ScoreBar score={review.score} />

          {/* Token savings */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <TokenBadge count={review.estimatedOriginalTokens} label="Before" />
            <span style={{ opacity: 0.5 }}>→</span>
            <TokenBadge count={review.estimatedImprovedTokens} label="After" />
            {savings > 0 && (
              <span style={{ fontSize: 11, color: '#4ec9b0', fontWeight: 600 }}>
                −{savings} tokens saved ({Math.round((savings / review.estimatedOriginalTokens) * 100)}%)
              </span>
            )}
          </div>

          {/* Feedback */}
          <div style={{ fontSize: 12, padding: '8px 10px', background: 'var(--vscode-editor-background)', borderRadius: 4, lineHeight: 1.6 }}>
            <strong>Feedback</strong>
            <p style={{ margin: '4px 0 0' }}>{review.feedback}</p>
          </div>

          {/* Token issues */}
          {review.tokenIssues?.length > 0 && (
            <div style={{ fontSize: 12 }}>
              <strong>Token waste detected</strong>
              <ul style={{ margin: '4px 0 0', paddingLeft: 18, lineHeight: 1.8 }}>
                {review.tokenIssues.map((issue: string, i: number) => (
                  <li key={i} style={{ color: '#dcdcaa' }}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Improved prompt */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <strong style={{ fontSize: 12 }}>Optimized Prompt</strong>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={handleCopy} style={smallBtn}>
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
                <button onClick={handleUseImproved} style={{ ...smallBtn, background: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)' }}>
                  Use this ↑
                </button>
              </div>
            </div>
            <pre style={{
              margin: 0, padding: '10px', borderRadius: 4, fontSize: 12,
              background: 'var(--vscode-editor-background)',
              border: '1px solid var(--vscode-panel-border)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6
            }}>
              {review.improvedPrompt}
            </pre>
          </div>
        </div>
      )}

      <hr style={{ margin: '20px 0', borderColor: 'var(--vscode-panel-border)', borderWidth: '1px 0 0' }} />

      {/* Change Reviewer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>🔍</span>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
          Change Review
        </h2>
      </div>
      <p style={{ margin: '0 0 8px', fontSize: 12, opacity: 0.7 }}>Review the git diff of your current workspace.</p>
      <button
        onClick={handleReviewChanges}
        disabled={loading}
        style={{
          width: '100%', background: 'var(--vscode-button-secondaryBackground)',
          color: 'var(--vscode-button-secondaryForeground)',
          border: 'none', borderRadius: 4, padding: '8px 0',
          cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600
        }}
      >
        {loading ? '⟳  Reviewing...' : '🔍  Review Changes'}
      </button>

      {changeReview && (
        <div style={{ marginTop: 12, fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.6, padding: '10px', background: 'var(--vscode-editor-background)', borderRadius: 4 }}>
          {changeReview}
        </div>
      )}
    </div>
  );
};

const smallBtn: React.CSSProperties = {
  background: 'var(--vscode-button-secondaryBackground)',
  color: 'var(--vscode-button-secondaryForeground)',
  border: 'none', borderRadius: 3, padding: '3px 8px',
  cursor: 'pointer', fontSize: 11
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
