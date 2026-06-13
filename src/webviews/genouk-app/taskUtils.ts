import { SessionPlan, SessionTask } from './types';

export type Status = SessionTask['status'];

export const STATUS_ORDER: Status[] = ['todo', 'in_progress', 'completed'];

export const STATUS_LABEL: Record<Status, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  completed: 'Done',
};

/** Move a task one step forward in the workflow (todo → in_progress → completed). */
export function advance(status: Status): Status {
  const i = STATUS_ORDER.indexOf(status);
  return STATUS_ORDER[Math.min(STATUS_ORDER.length - 1, i + 1)];
}

/** Move a task one step back (completed → in_progress → todo). */
export function regress(status: Status): Status {
  const i = STATUS_ORDER.indexOf(status);
  return STATUS_ORDER[Math.max(0, i - 1)];
}

export function setStatus(plan: SessionPlan, id: string, status: Status): SessionPlan {
  return { ...plan, tasks: plan.tasks.map((x) => (x.id === id ? { ...x, status } : x)) };
}

export function removeTask(plan: SessionPlan, id: string): SessionPlan {
  return { ...plan, tasks: plan.tasks.filter((x) => x.id !== id) };
}

export function updateTask(plan: SessionPlan, id: string, patch: Partial<SessionTask>): SessionPlan {
  return { ...plan, tasks: plan.tasks.map((x) => (x.id === id ? { ...x, ...patch } : x)) };
}

export function addTask(plan: SessionPlan, task: SessionTask): SessionPlan {
  return { ...plan, tasks: [...plan.tasks, task] };
}

export interface PlanStats {
  total: number;
  done: number;
  inProgress: number;
  pct: number;
  totalMinutes: number;
  remainingMinutes: number;
}

export function planStats(plan: SessionPlan): PlanStats {
  const total = plan.tasks.length;
  const done = plan.tasks.filter((x) => x.status === 'completed').length;
  const inProgress = plan.tasks.filter((x) => x.status === 'in_progress').length;
  const totalMinutes = plan.tasks.reduce((sum, x) => sum + (x.estimatedMinutes || 0), 0);
  const remainingMinutes = plan.tasks
    .filter((x) => x.status !== 'completed')
    .reduce((sum, x) => sum + (x.estimatedMinutes || 0), 0);
  return {
    total,
    done,
    inProgress,
    pct: total > 0 ? Math.round((done / total) * 100) : 0,
    totalMinutes,
    remainingMinutes,
  };
}

/** "1h 25m" / "45m" from minutes. */
export function formatDuration(mins: number): string {
  if (mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
