import React, { useEffect, useRef, useState } from 'react';
import { ListTodo, RefreshCw, X, Bell, AlertCircle, Copy, Sparkles, Eraser } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { t } from './theme';
import { Card, Label, PrimaryButton, GhostButton, LoadingRow } from './ui';
import { SessionPlan } from './types';
import { addTask, setStatus, clearCompleted, planToMarkdown, planStats } from './taskUtils';
import { TaskBoard, PlanSummary } from './TaskBoard';
import { AddTaskForm } from './AddTaskForm';
import { FocusTimerCard } from './FocusTimerCard';
import { useFocusTimer, FocusPhase } from './useFocusTimer';
import { BREAK_NUDGES } from './quips';
import { nextTaskTitle } from './taskUtils';

declare const window: any;


export const PlannerView: React.FC = () => {
  const vsCodeRef = useRef<any>(null);
  if (!vsCodeRef.current) vsCodeRef.current = window.acquireVsCodeApi();
  const vscode = vsCodeRef.current;

  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [goal, setGoal] = useState('');
  const [error, setError] = useState('');
  const [banner, setBanner] = useState<string | null>(null);
  const [syncingLinear, setSyncingLinear] = useState(false);
  const [extending, setExtending] = useState(false);
  const [extendText, setExtendText] = useState('');

  const planRef = useRef<SessionPlan | null>(null);
  useEffect(() => { planRef.current = plan; }, [plan]);

  useEffect(() => {
    const handle = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'sessionPlan':
          setPlan(message.value);
          setLoading(false);
          break;
        case 'syncToLinearResult':
          setSyncingLinear(false);
          break;
        case 'extendSessionPlanDone':
          setExtending(false);
          setExtendText('');
          break;
        case 'error':
          setError(message.value);
          setLoading(false);
          setSyncingLinear(false);
          setExtending(false);
          break;
      }
    };
    window.addEventListener('message', handle);
    vscode.postMessage({ type: 'getSessionPlan' });
    return () => window.removeEventListener('message', handle);
  }, []);

  const save = (next: SessionPlan | null) => {
    setPlan(next);
    vscode.postMessage({ type: 'saveSessionPlan', value: next });
  };

  const generate = () => {
    if (!goal.trim()) return;
    setLoading(true);
    setError('');
    vscode.postMessage({ type: 'generateSessionPlan', value: goal });
  };

  const handleSyncLinear = () => {
    setSyncingLinear(true);
    setError('');
    vscode.postMessage({ type: 'syncToLinear' });
  };

  const handleExportMarkdown = () => {
    if (!plan) return;
    vscode.postMessage({ type: 'copyText', value: planToMarkdown(plan), label: 'Plan' });
    showBanner('Plan copied as Markdown. 📋');
  };

  const handleClearDone = () => {
    if (!plan) return;
    save(clearCompleted(plan));
  };

  const handleExtend = () => {
    if (!extendText.trim() || extending) return;
    setExtending(true);
    setError('');
    vscode.postMessage({ type: 'extendSessionPlan', value: extendText.trim() });
  };

  const getNextTaskTitle = (): string | null => nextTaskTitle(planRef.current);

  // The session task the current focus block is dedicated to (see App for the
  // mirror of this logic on the sidebar side).
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [pendingCompleteId, setPendingCompleteId] = useState<string | null>(null);

  useEffect(() => {
    const tasks = plan?.tasks ?? [];
    const stillValid = tasks.some((x) => x.id === focusTaskId && x.status !== 'completed');
    if (stillValid) return;
    const next = tasks.find((x) => x.status === 'in_progress') ?? tasks.find((x) => x.status === 'todo') ?? null;
    setFocusTaskId(next ? next.id : null);
  }, [plan]);

  const focusTask = plan?.tasks.find((x) => x.id === focusTaskId) ?? null;
  const focusableTasks = plan?.tasks.filter((x) => x.status !== 'completed') ?? [];
  const pendingCompleteTask = plan?.tasks.find((x) => x.id === pendingCompleteId) ?? null;

  const showBanner = (text: string) => {
    setBanner(text);
    window.setTimeout(() => setBanner((b) => (b === text ? null : b)), 12000);
  };

  const handlePhaseEnd = (ended: FocusPhase, next: FocusPhase) => {
    if (next === 'break') {
      const finished = planRef.current?.tasks.find((x) => x.id === focusTaskId);
      if (ended === 'focus' && finished && finished.status !== 'completed') {
        setPendingCompleteId(finished.id);
        showBanner(`Focus block done — finished “${finished.title}”?`);
      } else {
        showBanner(BREAK_NUDGES[Math.floor(Math.random() * BREAK_NUDGES.length)]);
      }
    } else {
      const task = getNextTaskTitle();
      showBanner(task ? `Break over. Next up: ${task}` : 'Break over — back to it.');
    }
  };

  const timer = useFocusTimer(handlePhaseEnd);

  const startFocus = () => {
    timer.start();
    if (timer.phase === 'focus') {
      const current = planRef.current;
      const task = current?.tasks.find((x) => x.id === focusTaskId) ?? null;
      if (current && task && task.status === 'todo') {
        save(setStatus(current, task.id, 'in_progress'));
      }
      showBanner(task ? `Focus block started. Working on: ${task.title}` : 'Focus block started.');
    }
  };

  const handleSelectFocusTask = (id: string) => setFocusTaskId(id);

  const handleCompleteFocusTask = (id: string) => {
    const current = planRef.current;
    if (current) save(setStatus(current, id, 'completed'));
    setPendingCompleteId(null);
    showBanner('Checked off. 🎉');
  };

  const handleDismissComplete = () => setPendingCompleteId(null);

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: t.color.inputBg, color: t.color.inputFg,
    border: `1px solid ${t.color.inputBorder}`, borderRadius: t.radius.sm,
    padding: '8px 10px', fontSize: t.font.size.md, fontFamily: t.font.ui, outline: 'none',
  };

  return (
    <div style={{ fontFamily: t.font.ui, color: t.color.fg, background: t.color.bg, minHeight: '100vh', padding: t.space.lg, boxSizing: 'border-box' }}>
      <style dangerouslySetInnerHTML={{ __html: `@keyframes genouk-spin { to { transform: rotate(360deg); } } body { margin: 0; }` }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: t.space.lg, maxWidth: 1100, marginLeft: 'auto', marginRight: 'auto' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: t.font.weight.semibold }}>Session Planner</h1>
          <p style={{ margin: '2px 0 0', fontSize: t.font.size.md, color: t.color.muted }}>Plan, track, and time-box your coding session.</p>
        </div>
        {plan && (
          <div style={{ display: 'flex', gap: t.space.sm }}>
            <GhostButton onClick={handleExportMarkdown} title="Copy plan as a Markdown checklist">
              <Copy size={13} /> Export MD
            </GhostButton>
            <GhostButton onClick={handleSyncLinear} disabled={syncingLinear} title="Sync tasks to Linear">
              <RefreshCw size={13} className={syncingLinear ? "genouk-spin" : ""} /> {syncingLinear ? "Syncing..." : "Sync Linear"}
            </GhostButton>
            <GhostButton onClick={() => save(null)} title="Clear this plan">
              <RefreshCw size={13} /> New plan
            </GhostButton>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: t.space.lg }}>
        {/* Reminder banner */}
        <AnimatePresence>
          {banner && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              style={{ display: 'flex', alignItems: 'center', gap: t.space.sm, background: t.color.accentBg, color: t.color.accentFg, borderRadius: t.radius.md, padding: '10px 14px' }}
            >
              <Bell size={15} />
              <span style={{ flex: 1, fontSize: t.font.size.md, fontWeight: t.font.weight.medium }}>{banner}</span>
              <button onClick={() => setBanner(null)} style={{ background: 'transparent', border: 'none', color: t.color.accentFg, cursor: 'pointer', display: 'flex', opacity: 0.8 }}>
                <X size={15} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div style={{ display: 'flex', gap: t.space.sm, alignItems: 'center', background: t.color.errorBg, border: `1px solid ${t.color.errorBorder}`, borderRadius: t.radius.sm, padding: '8px 12px', fontSize: t.font.size.md }}>
            <AlertCircle size={15} style={{ color: t.color.bad }} /> {error}
          </div>
        )}

        {loading ? (
          <Card><LoadingRow label="Planning your session…" /></Card>
        ) : !plan ? (
          <Card style={{ maxWidth: 560, margin: '0 auto', width: '100%' }}>
            <Label>What are you building this session?</Label>
            <p style={{ margin: '4px 0 10px', fontSize: t.font.size.base, color: t.color.muted, lineHeight: 1.5 }}>
              Describe the goal — Genouk breaks it into a tracked, time-boxed checklist.
            </p>
            <textarea
              rows={5}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Add JWT auth with refresh tokens, middleware, and a login form…"
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            />
            <PrimaryButton onClick={generate} disabled={!goal.trim()} style={{ marginTop: t.space.sm }}>
              <ListTodo size={14} /> Generate plan
            </PrimaryButton>
          </Card>
        ) : (
          <div style={{ display: 'flex', gap: t.space.lg, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* Left rail: goal, timer, summary */}
            <div style={{ flex: '1 1 280px', minWidth: 260, display: 'flex', flexDirection: 'column', gap: t.space.md }}>
              <Card>
                <Label color={t.color.accent}>Goal</Label>
                <h3 style={{ margin: '6px 0 2px', fontSize: t.font.size.lg, fontWeight: t.font.weight.semibold, lineHeight: 1.3 }}>{plan.goal}</h3>
                <span style={{ fontSize: t.font.size.sm, color: t.color.muted }}>Est. {plan.estimatedDuration}</span>
                <div style={{ marginTop: t.space.md }}>
                  <PlanSummary plan={plan} />
                </div>
              </Card>
              <FocusTimerCard
                timer={timer}
                onStart={startFocus}
                tasks={focusableTasks}
                focusTask={focusTask}
                onSelectTask={handleSelectFocusTask}
                pendingComplete={pendingCompleteTask}
                onComplete={handleCompleteFocusTask}
                onDismissComplete={handleDismissComplete}
              />
            </div>

            {/* Right: kanban board */}
            <div style={{ flex: '3 1 480px', minWidth: 300, display: 'flex', flexDirection: 'column', gap: t.space.md }}>
              <Card style={{ display: 'flex', flexDirection: 'column', gap: t.space.md }}>
                <TaskBoard plan={plan} onSave={save} layout="columns" />
                {planStats(plan).done > 0 && (
                  <GhostButton onClick={handleClearDone} title="Remove completed tasks" style={{ alignSelf: 'flex-start' }}>
                    <Eraser size={13} /> Clear {planStats(plan).done} done
                  </GhostButton>
                )}
              </Card>

              {/* Extend the plan with more AI-generated tasks */}
              <Card style={{ display: 'flex', flexDirection: 'column', gap: t.space.sm }}>
                <Label color={t.color.accent}>Add tasks with AI</Label>
                <div style={{ display: 'flex', gap: t.space.sm }}>
                  <input
                    type="text"
                    value={extendText}
                    onChange={(e) => setExtendText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleExtend(); }}
                    placeholder="e.g. add tests and error handling…"
                    disabled={extending}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <PrimaryButton onClick={handleExtend} disabled={!extendText.trim() || extending}>
                    <Sparkles size={14} /> {extending ? 'Adding…' : 'Add'}
                  </PrimaryButton>
                </div>
              </Card>

              <AddTaskForm onAdd={(task) => save(addTask(plan, task))} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
