import React, { useState } from 'react';
import { ListTodo, RefreshCw, Plus, Trash2, CheckSquare, Square } from 'lucide-react';
import { t } from './theme';
import { Card, Label, PrimaryButton, GhostButton, LoadingRow, EmptyState } from './ui';
import { SessionPlan, SessionTask } from './types';

interface Props {
  plan: SessionPlan | null;
  loading: boolean;
  onGenerate: (goal: string) => void;
  onSave: (plan: SessionPlan | null) => void;
}

const DIFF_COLOR: Record<SessionTask['difficulty'], string> = {
  easy: t.color.good,
  medium: t.color.warn,
  hard: t.color.bad,
};

export const SessionTab: React.FC<Props> = ({ plan, loading, onGenerate, onSave }) => {
  const [goal, setGoal] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newEst, setNewEst] = useState(15);
  const [newDiff, setNewDiff] = useState<SessionTask['difficulty']>('medium');

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

  if (loading) return <Card><LoadingRow label="Planning your session…" /></Card>;

  if (!plan) {
    return (
      <Card>
        <Label>Plan a coding session</Label>
        <p style={{ margin: '4px 0 10px', fontSize: t.font.size.base, color: t.color.muted, lineHeight: 1.4 }}>
          Describe your goal and Genouk breaks it into a tracked checklist of tasks.
        </p>
        <textarea
          rows={4}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="e.g. Add JWT auth with middleware and persist the active session…"
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
        />
        <PrimaryButton onClick={() => onGenerate(goal)} disabled={!goal.trim()} style={{ marginTop: t.space.sm }}>
          <ListTodo size={14} /> Generate plan
        </PrimaryButton>
      </Card>
    );
  }

  const total = plan.tasks.length;
  const done = plan.tasks.filter((x) => x.status === 'completed').length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const toggle = (id: string) => {
    onSave({
      ...plan,
      tasks: plan.tasks.map((x) => {
        if (x.id !== id) return x;
        const next: SessionTask['status'] = x.status === 'todo' ? 'in_progress' : x.status === 'in_progress' ? 'completed' : 'todo';
        return { ...x, status: next };
      }),
    });
  };

  const remove = (id: string) => onSave({ ...plan, tasks: plan.tasks.filter((x) => x.id !== id) });

  const add = () => {
    if (!newTitle.trim()) return;
    onSave({
      ...plan,
      tasks: [...plan.tasks, { id: `custom-${Date.now()}`, title: newTitle, description: 'Manually added task.', estimatedMinutes: newEst, difficulty: newDiff, status: 'todo' }],
    });
    setNewTitle('');
    setShowAdd(false);
  };

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: t.space.md }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: t.space.sm }}>
        <div style={{ minWidth: 0 }}>
          <Label color={t.color.accent}>Active plan</Label>
          <h3 style={{ margin: '4px 0 2px', fontSize: t.font.size.lg, fontWeight: t.font.weight.semibold, color: t.color.fg }}>{plan.goal}</h3>
          <span style={{ fontSize: t.font.size.sm, color: t.color.muted }}>Est. {plan.estimatedDuration}</span>
        </div>
        <GhostButton onClick={() => onSave(null)} title="Clear this plan">
          <RefreshCw size={12} /> Reset
        </GhostButton>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: t.space.xs }}>
          <Label>Progress</Label>
          <span style={{ fontSize: t.font.size.sm, color: t.color.muted }}>{done}/{total} · {pct}%</span>
        </div>
        <div style={{ background: t.color.surfaceHover, borderRadius: 999, height: 6, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, background: t.color.good, height: '100%', borderRadius: 999, transition: `width ${t.motion.base}s ease` }} />
        </div>
      </div>

      <div style={{ border: `1px solid ${t.color.border}`, borderRadius: t.radius.sm }}>
        {plan.tasks.length === 0 ? (
          <EmptyState>No tasks. Add one below.</EmptyState>
        ) : (
          plan.tasks.map((task, i) => (
            <div
              key={task.id}
              style={{
                display: 'flex',
                gap: t.space.sm,
                padding: t.space.sm,
                borderTop: i === 0 ? 'none' : `1px solid ${t.color.border}`,
                opacity: task.status === 'completed' ? 0.55 : 1,
              }}
            >
              <button
                onClick={() => toggle(task.id)}
                title="Cycle: todo → in progress → done"
                style={{ background: 'transparent', border: 'none', padding: 0, marginTop: 2, cursor: 'pointer', color: task.status === 'completed' ? t.color.good : t.color.muted }}
              >
                {task.status === 'completed' ? <CheckSquare size={16} /> : <Square size={16} />}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: t.space.sm, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: t.font.weight.semibold, fontSize: t.font.size.md, color: t.color.fg, textDecoration: task.status === 'completed' ? 'line-through' : 'none' }}>
                    {task.title}
                  </span>
                  <span style={{ fontSize: t.font.size.xs, fontWeight: t.font.weight.semibold, textTransform: 'uppercase', letterSpacing: 0.5, color: DIFF_COLOR[task.difficulty] }}>
                    {task.difficulty}
                  </span>
                </div>
                <p style={{ margin: '3px 0 0', fontSize: t.font.size.base, color: t.color.muted, lineHeight: 1.45 }}>{task.description}</p>
                <span style={{ fontSize: t.font.size.xs, color: t.color.muted, fontFamily: t.font.mono, display: 'block', marginTop: 4 }}>
                  {task.estimatedMinutes} min · {task.status === 'in_progress' ? 'in progress' : task.status}
                </span>
              </div>
              <button onClick={() => remove(task.id)} title="Delete task" style={{ background: 'transparent', border: 'none', color: t.color.muted, cursor: 'pointer', padding: 2, height: 'fit-content' }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>

      {showAdd ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: t.space.sm, padding: t.space.sm, border: `1px solid ${t.color.border}`, borderRadius: t.radius.sm }}>
          <Label>Add task</Label>
          <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Task title…" style={inputStyle} />
          <div style={{ display: 'flex', gap: t.space.sm }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: t.font.size.xs, color: t.color.muted, display: 'block', marginBottom: 2 }}>Est. minutes</span>
              <input type="number" value={newEst} onChange={(e) => setNewEst(parseInt(e.target.value) || 15)} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: t.font.size.xs, color: t.color.muted, display: 'block', marginBottom: 2 }}>Difficulty</span>
              <select value={newDiff} onChange={(e) => setNewDiff(e.target.value as SessionTask['difficulty'])} style={inputStyle}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: t.space.sm }}>
            <PrimaryButton onClick={add} disabled={!newTitle.trim()} style={{ flex: 1 }}>Add</PrimaryButton>
            <GhostButton onClick={() => setShowAdd(false)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</GhostButton>
          </div>
        </div>
      ) : (
        <GhostButton onClick={() => setShowAdd(true)} style={{ justifyContent: 'center', borderStyle: 'dashed', padding: '8px' }}>
          <Plus size={13} /> Add task
        </GhostButton>
      )}
    </Card>
  );
};
