import React, { useState } from 'react';
import { ListTodo, RefreshCw, ExternalLink } from 'lucide-react';
import { t } from './theme';
import { Card, Label, PrimaryButton, GhostButton, LoadingRow } from './ui';
import { SessionPlan } from './types';
import { addTask } from './taskUtils';
import { TaskBoard, PlanSummary } from './TaskBoard';
import { AddTaskForm } from './AddTaskForm';

interface Props {
  plan: SessionPlan | null;
  loading: boolean;
  onGenerate: (goal: string) => void;
  onSave: (plan: SessionPlan | null) => void;
  /** Open the standalone popout planner window. */
  onPopout: () => void;
  onSyncLinear?: () => void;
  syncingLinear?: boolean;
}

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

export const SessionTab: React.FC<Props> = ({ plan, loading, onGenerate, onSave, onPopout, onSyncLinear, syncingLinear }) => {
  const [goal, setGoal] = useState('');

  if (loading) return <Card><LoadingRow label="Planning your session…" /></Card>;

  if (!plan) {
    return (
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: t.space.xs }}>
          <Label>Plan a coding session</Label>
          <GhostButton onClick={onPopout} title="Open planner in its own window">
            <ExternalLink size={12} /> Popout
          </GhostButton>
        </div>
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
        <PrimaryButton id="genouk-btn-generateSession" onClick={() => onGenerate(goal)} disabled={!goal.trim()} style={{ marginTop: t.space.sm }}>
          <ListTodo size={14} /> Generate plan
        </PrimaryButton>
      </Card>
    );
  }

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: t.space.md }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: t.space.sm }}>
        <div style={{ minWidth: 0, flex: '1 1 180px' }}>
          <Label color={t.color.accent}>Active plan</Label>
          <h3 style={{ margin: '4px 0 2px', fontSize: t.font.size.lg, fontWeight: t.font.weight.semibold, color: t.color.fg }}>{plan.goal}</h3>
          <span style={{ fontSize: t.font.size.sm, color: t.color.muted }}>Est. {plan.estimatedDuration}</span>
        </div>
        <div style={{ display: 'flex', gap: t.space.xs, flexShrink: 0 }}>
          {onSyncLinear && (
            <GhostButton onClick={onSyncLinear} disabled={syncingLinear} title="Sync tasks to Linear">
              <RefreshCw size={12} className={syncingLinear ? "genouk-spin" : ""} /> {syncingLinear ? "Syncing..." : "Sync Linear"}
            </GhostButton>
          )}
          <GhostButton onClick={onPopout} title="Open in its own window">
            <ExternalLink size={12} /> Popout
          </GhostButton>
          <GhostButton onClick={() => onSave(null)} title="Clear this plan">
            <RefreshCw size={12} /> Reset
          </GhostButton>
        </div>
      </div>

      <PlanSummary plan={plan} />
      <TaskBoard plan={plan} onSave={onSave} layout="stack" />
      <AddTaskForm onAdd={(task) => onSave(addTask(plan, task))} />
    </Card>
  );
};
