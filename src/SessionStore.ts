import * as vscode from 'vscode';
import { SessionPlanner, SessionPlan } from './SessionPlanner';

/**
 * Single source of truth for the active session plan. Persists to workspaceState
 * and broadcasts changes so every open view (the sidebar and the popout planner
 * window) re-renders in lockstep — edit a task in one, it updates in the other.
 */
export class SessionStore {
  private readonly _onDidChange = new vscode.EventEmitter<SessionPlan | null>();
  readonly onDidChange = this._onDidChange.event;
  private readonly planner = new SessionPlanner();

  constructor(private readonly ctx: vscode.ExtensionContext) {}

  get(): SessionPlan | null {
    return this.ctx.workspaceState.get<SessionPlan>('sessionPlan') ?? null;
  }

  async set(plan: SessionPlan | null): Promise<void> {
    await this.ctx.workspaceState.update('sessionPlan', plan ?? undefined);
    this._onDidChange.fire(plan);
  }

  async generate(goal: string): Promise<SessionPlan> {
    const plan = await this.planner.generateSessionPlan(goal);
    await this.set(plan);
    return plan;
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}
