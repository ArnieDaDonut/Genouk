import React, { useEffect, useRef, useState } from 'react';
import { ListTodo, RefreshCw, X, Bell, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { t } from './theme';
import { Card, Label, PrimaryButton, GhostButton, LoadingRow } from './ui';
import { SessionPlan } from './types';
import { addTask } from './taskUtils';
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
        case 'error':
          setError(message.value);
          setLoading(false);
          setSyncingLinear(false);
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

  const getNextTaskTitle = (): string | null => nextTaskTitle(planRef.current);

  const showBanner = (text: string) => {
    setBanner(text);
    window.setTimeout(() => setBanner((b) => (b === text ? null : b)), 12000);
  };

  const handlePhaseEnd = (_ended: FocusPhase, next: FocusPhase) => {
    if (next === 'break') {
      showBanner(BREAK_NUDGES[Math.floor(Math.random() * BREAK_NUDGES.length)]);
    } else {
      const task = getNextTaskTitle();
      showBanner(task ? `Break over. Next up: ${task}` : 'Break over — back to it.');
    }
  };

  const timer = useFocusTimer(handlePhaseEnd);

  const startFocus = () => {
    timer.start();
    if (timer.phase === 'focus') {
      const task = getNextTaskTitle();
      showBanner(task ? `Focus block started. Working on: ${task}` : 'Focus block started.');
    }
  };

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
              <FocusTimerCard timer={timer} onStart={startFocus} />
            </div>

            {/* Right: kanban board */}
            <div style={{ flex: '3 1 480px', minWidth: 300, display: 'flex', flexDirection: 'column', gap: t.space.md }}>
              <Card style={{ display: 'flex', flexDirection: 'column', gap: t.space.md }}>
                <TaskBoard plan={plan} onSave={save} layout="columns" />
              </Card>
              <AddTaskForm onAdd={(task) => save(addTask(plan, task))} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
