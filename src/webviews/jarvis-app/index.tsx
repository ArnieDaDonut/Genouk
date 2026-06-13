import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

declare const window: any;
const vscode = window.acquireVsCodeApi();

const App = () => {
  const [prompt, setPrompt] = useState('');
  const [review, setReview] = useState<any>(null);
  const [changeReview, setChangeReview] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    setLoading(true);
    setError('');
    setReview(null);
    vscode.postMessage({ type: 'reviewPrompt', value: prompt });
  };

  const handleReviewChanges = () => {
    setLoading(true);
    setError('');
    setChangeReview('');
    vscode.postMessage({ type: 'reviewChanges' });
  };

  return (
    <div>
      <h2>Draft Prompt</h2>
      <textarea
        rows={5}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Type your prompt here to be reviewed..."
      />
      <button onClick={handleReviewPrompt} disabled={loading || !prompt}>
        {loading ? 'Reviewing...' : 'Review Prompt'}
      </button>

      {error && <div className="error" style={{ marginTop: 10 }}><strong>Error:</strong> {error}</div>}

      {review && (
        <div style={{ marginTop: 20 }}>
          <h3>Review Result</h3>
          <p><strong>Ready:</strong> {review.isFinished ? '✅ Yes' : '❌ No'} (Score: {review.score}/100)</p>
          <p><strong>Feedback:</strong> {review.feedback}</p>
          <div>
            <strong>Improved Prompt:</strong>
            <pre style={{ background: 'var(--vscode-editor-background)', padding: 10, whiteSpace: 'pre-wrap' }}>
              {review.improvedPrompt}
            </pre>
          </div>
          <button onClick={() => setPrompt(review.improvedPrompt)}>Use Improved Prompt</button>
        </div>
      )}

      <hr style={{ margin: '20px 0' }} />
      <h2>Post-Execution Review</h2>
      <p>Click below to review the git diff of your workspace.</p>
      <button onClick={handleReviewChanges} disabled={loading}>
        {loading ? 'Reviewing...' : 'Review Changes'}
      </button>

      {changeReview && (
        <div style={{ marginTop: 20 }}>
          <h3>Code Review</h3>
          <div style={{ whiteSpace: 'pre-wrap' }}>{changeReview}</div>
        </div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
