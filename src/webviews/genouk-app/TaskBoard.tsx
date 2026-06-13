import React from 'react';
import { ChevronLeft, ChevronRight, Check, Circle, CircleDot, Trash2, Clock, ExternalLink } from 'lucide-react';
import { t } from './theme';
import { Label } from './ui';
import { SessionPlan, SessionTask } from './types';
import {
  Status, STATUS_ORDER, STATUS_LABEL, advance, regress, setStatus, removeTask, planStats, formatDuration,
} from './taskUtils';

const DIFF_COLOR: Record<SessionTask['difficulty'], string> = {
  easy: t.color.good,
  medium: t.color.warn,
  hard: t.color.bad,
};

const STATUS_ICON: Record<Status, React.ReactNode> = {
  todo: <Circle size={15} />,
  in_progress: <CircleDot size={15} />,
  completed: <Check size={15} />,
};

/** Compact metrics strip: progress, counts, and remaining vs total time. */
export const PlanSummary: React.FC<{ plan: SessionPlan }> = ({ plan }) => {
  const s = planStats(plan);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: t.space.sm }}>
      <div style={{ display: 'flex', gap: t.space.sm, flexWrap: 'wrap' }}>
        <Metric value={`${s.done}/${s.total}`} label="Done" />
        <Metric value={String(s.inProgress)} label="Active" />
        <Metric value={formatDuration(s.remainingMinutes)} label="Remaining" accent />
        <Metric value={formatDuration(s.totalMinutes)} label="Total" />
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: t.space.xs }}>
          <Label>Progress</Label>
          <span style={{ fontSize: t.font.size.sm, color: t.color.muted, fontFamily: t.font.mono }}>{s.pct}%</span>
        </div>
        <div style={{ background: t.color.surfaceHover, borderRadius: 999, height: 6, overflow: 'hidden' }}>
          <div style={{ width: `${s.pct}%`, background: t.color.good, height: '100%', borderRadius: 999, transition: `width ${t.motion.slow}s ease` }} />
        </div>
      </div>
    </div>
  );
};

const Metric: React.FC<{ value: string; label: string; accent?: boolean }> = ({ value, label, accent }) => (
  <div style={{ flex: '1 1 64px', minWidth: 64, background: t.color.surfaceHover, border: `1px solid ${t.color.border}`, borderRadius: t.radius.sm, padding: '6px 8px' }}>
    <div style={{ fontSize: t.font.size.lg, fontWeight: t.font.weight.semibold, color: accent ? t.color.accent : t.color.fg, fontFamily: t.font.mono, lineHeight: 1.1 }}>{value}</div>
    <div style={{ fontSize: t.font.size.xs, color: t.color.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{label}</div>
  </div>
);

interface TaskCardProps {
  task: SessionTask;
  onAdvance: () => void;
  onRegress: () => void;
  onRemove: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onAdvance, onRegress, onRemove }) => {
  const isDone = task.status === 'completed';
  const isFirst = task.status === STATUS_ORDER[0];
  const isLast = task.status === STATUS_ORDER[STATUS_ORDER.length - 1];

  return (
    <div
      style={{
        background: t.color.surface,
        border: `1px solid ${t.color.border}`,
        borderRadius: t.radius.sm,
        padding: t.space.sm,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        opacity: isDone ? 0.6 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: t.space.sm }}>
        <button
          onClick={onAdvance}
          title="Advance status"
          style={{ background: 'transparent', border: 'none', padding: 0, marginTop: 1, cursor: 'pointer', color: isDone ? t.color.good : t.color.muted, flexShrink: 0 }}
        >
          {STATUS_ICON[task.status]}
        </button>
        <span style={{ flex: 1, minWidth: 0, fontWeight: t.font.weight.semibold, fontSize: t.font.size.md, color: t.color.fg, textDecoration: isDone ? 'line-through' : 'none', lineHeight: 1.35 }}>
          {task.title}
        </span>
        {task.linearIssueUrl && (
          <a href={task.linearIssueUrl} target="_blank" rel="noreferrer" title="Open in Linear" style={{ color: t.color.accent, cursor: 'pointer', flexShrink: 0, marginTop: 2 }}>
            <ExternalLink size={14} />
          </a>
        )}
        <button onClick={onRemove} title="Delete task" style={{ background: 'transparent', border: 'none', color: t.color.muted, cursor: 'pointer', padding: 0, flexShrink: 0 }}>
          <Trash2 size={13} />
        </button>
      </div>

      {task.description && (
        <p style={{ margin: 0, fontSize: t.font.size.base, color: t.color.muted, lineHeight: 1.45, paddingLeft: 23 }}>{task.description}</p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: t.space.sm, paddingLeft: 23 }}>
        <span style={{ fontSize: t.font.size.xs, fontWeight: t.font.weight.semibold, textTransform: 'uppercase', letterSpacing: 0.5, color: DIFF_COLOR[task.difficulty] }}>
          {task.difficulty}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: t.font.size.xs, color: t.color.muted, fontFamily: t.font.mono }}>
          <Clock size={11} /> {task.estimatedMinutes}m
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={onRegress} disabled={isFirst} title="Move back" style={moveBtn(isFirst)}>
          <ChevronLeft size={14} />
        </button>
        <button onClick={onAdvance} disabled={isLast} title="Move forward" style={moveBtn(isLast)}>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

const moveBtn = (disabled: boolean): React.CSSProperties => ({
  background: 'transparent',
  border: `1px solid ${t.color.border}`,
  borderRadius: t.radius.sm,
  color: disabled ? t.color.border : t.color.fg,
  cursor: disabled ? 'not-allowed' : 'pointer',
  padding: '1px 4px',
  display: 'inline-flex',
  alignItems: 'center',
});

interface Props {
  plan: SessionPlan;
  onSave: (plan: SessionPlan) => void;
  /** 'columns' = kanban (popout), 'stack' = vertical groups (narrow sidebar). */
  layout?: 'columns' | 'stack';
}

export const TaskBoard: React.FC<Props> = ({ plan, onSave, layout = 'stack' }) => {
  const columns = layout === 'columns';

  const renderColumn = (status: Status) => {
    const tasks = plan.tasks.filter((x) => x.status === status);
    return (
      <div
        key={status}
        style={{
          flex: columns ? '1 1 0' : undefined,
          minWidth: columns ? 200 : undefined,
          display: 'flex',
          flexDirection: 'column',
          gap: t.space.sm,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Label color={status === 'completed' ? t.color.good : status === 'in_progress' ? t.color.accent : undefined}>
            {STATUS_LABEL[status]}
          </Label>
          <span style={{ fontSize: t.font.size.xs, color: t.color.muted, fontFamily: t.font.mono }}>{tasks.length}</span>
        </div>
        {tasks.length === 0 ? (
          <div style={{ border: `1px dashed ${t.color.border}`, borderRadius: t.radius.sm, padding: t.space.md, textAlign: 'center', color: t.color.muted, fontSize: t.font.size.sm }}>
            Nothing here
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onAdvance={() => onSave(setStatus(plan, task.id, advance(task.status)))}
              onRegress={() => onSave(setStatus(plan, task.id, regress(task.status)))}
              onRemove={() => onSave(removeTask(plan, task.id))}
            />
          ))
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: columns ? 'row' : 'column', gap: columns ? t.space.lg : t.space.md, alignItems: columns ? 'flex-start' : 'stretch' }}>
      {STATUS_ORDER.map(renderColumn)}
    </div>
  );
};
