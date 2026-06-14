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

/** Drop every completed task from the plan. */
export function clearCompleted(plan: SessionPlan): SessionPlan {
  return { ...plan, tasks: plan.tasks.filter((x) => x.status !== 'completed') };
}

/**
 * Reorder a task relative to its same-status neighbours (the board groups by
 * status, so swapping within the global array would look like nothing happened).
 * `dir` -1 moves it earlier, +1 later.
 */
export function moveTask(plan: SessionPlan, id: string, dir: -1 | 1): SessionPlan {
  const task = plan.tasks.find((x) => x.id === id);
  if (!task) return plan;
  const sameStatus = plan.tasks.filter((x) => x.status === task.status);
  const localIndex = sameStatus.findIndex((x) => x.id === id);
  const swapWith = sameStatus[localIndex + dir];
  if (!swapWith) return plan;

  const a = plan.tasks.findIndex((x) => x.id === id);
  const b = plan.tasks.findIndex((x) => x.id === swapWith.id);
  const tasks = [...plan.tasks];
  [tasks[a], tasks[b]] = [tasks[b], tasks[a]];
  return { ...plan, tasks };
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

/** Clock estimate for when the remaining work wraps up, e.g. "3:40 PM". */
export function estimatedFinish(remainingMinutes: number): string | null {
  if (remainingMinutes <= 0) return null;
  const done = new Date(Date.now() + remainingMinutes * 60_000);
  return done.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Render the plan as a GitHub-style Markdown checklist (for export/copy). */
export function planToMarkdown(plan: SessionPlan): string {
  const s = planStats(plan);
  const lines: string[] = [
    `# ${plan.goal}`,
    '',
    `**Estimated:** ${plan.estimatedDuration} · **Progress:** ${s.done}/${s.total} (${s.pct}%)`,
    '',
  ];
  for (const status of STATUS_ORDER) {
    const tasks = plan.tasks.filter((x) => x.status === status);
    if (tasks.length === 0) continue;
    lines.push(`## ${STATUS_LABEL[status]}`);
    for (const task of tasks) {
      const box = task.status === 'completed' ? '[x]' : '[ ]';
      lines.push(`- ${box} **${task.title}** _(${task.difficulty}, ${task.estimatedMinutes}m)_`);
      if (task.description) lines.push(`  - ${task.description}`);
    }
    lines.push('');
  }
  return lines.join('\n').trim() + '\n';
}

/** First in-progress task title, else first todo title, else null. */
export function nextTaskTitle(plan: SessionPlan | null): string | null {
  if (!plan) return null;
  const inProgress = plan.tasks.find((x) => x.status === 'in_progress');
  if (inProgress) return inProgress.title;
  const todo = plan.tasks.find((x) => x.status === 'todo');
  return todo ? todo.title : null;
}
