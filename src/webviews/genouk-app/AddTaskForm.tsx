import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { t } from './theme';
import { Label, PrimaryButton, GhostButton } from './ui';
import { SessionTask } from './types';

const inputStyle: React.CSSProperties = {
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

export const AddTaskForm: React.FC<{ onAdd: (task: SessionTask) => void }> = ({ onAdd }) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [est, setEst] = useState(15);
  const [diff, setDiff] = useState<SessionTask['difficulty']>('medium');

  const submit = () => {
    if (!title.trim()) return;
    onAdd({
      id: `custom-${Date.now()}`,
      title: title.trim(),
      description: desc.trim() || 'Manually added task.',
      estimatedMinutes: est,
      difficulty: diff,
      status: 'todo',
    });
    setTitle('');
    setDesc('');
    setEst(15);
    setDiff('medium');
    setOpen(false);
  };

  if (!open) {
    return (
      <GhostButton onClick={() => setOpen(true)} style={{ justifyContent: 'center', borderStyle: 'dashed', padding: '8px' }}>
        <Plus size={13} /> Add task
      </GhostButton>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: t.space.sm, padding: t.space.sm, border: `1px solid ${t.color.border}`, borderRadius: t.radius.sm }}>
      <Label>New task</Label>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        placeholder="Task title…"
        autoFocus
        style={inputStyle}
      />
      <input
        type="text"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Description (optional)…"
        style={inputStyle}
      />
      <div style={{ display: 'flex', gap: t.space.sm }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: t.font.size.xs, color: t.color.muted, display: 'block', marginBottom: 2 }}>Est. minutes</span>
          <input type="number" min={1} value={est} onChange={(e) => setEst(parseInt(e.target.value) || 15)} style={inputStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: t.font.size.xs, color: t.color.muted, display: 'block', marginBottom: 2 }}>Difficulty</span>
          <select value={diff} onChange={(e) => setDiff(e.target.value as SessionTask['difficulty'])} style={inputStyle}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: t.space.sm }}>
        <PrimaryButton onClick={submit} disabled={!title.trim()} style={{ flex: 1 }}>Add task</PrimaryButton>
        <GhostButton onClick={() => setOpen(false)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</GhostButton>
      </div>
    </div>
  );
};
