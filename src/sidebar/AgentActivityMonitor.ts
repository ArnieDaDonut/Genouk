import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { log } from '../log';

/** Play a notification through the OS, independent of the webview's Web Audio
 *  (which only works once the panel is open and clicked). Best-effort per
 *  platform; silently no-ops if the player isn't available. */
export function playSystemNotification(): void {
  try {
    if (process.platform === 'darwin') {
      spawn('afplay', ['/System/Library/Sounds/Glass.aiff'], { stdio: 'ignore' }).on('error', () => {});
    } else if (process.platform === 'win32') {
      // Windows: ask PowerShell to play the built-in notification asterisk.
      spawn('powershell', ['-NoProfile', '-Command', '[System.Media.SystemSounds]::Asterisk.Play()'], { stdio: 'ignore' }).on('error', () => {});
    } else {
      // Linux: try common players, ignore if none exist.
      spawn('paplay', ['/usr/share/sounds/freedesktop/stereo/complete.oga'], { stdio: 'ignore' }).on('error', () => {});
    }
  } catch {
    /* no audio player — fall back to the webview chime only */
  }
}

/**
 * Detects when an in-editor AI agent (Cursor Composer, Cline, Copilot agent,
 * Continue, …) finishes writing code, and plays Genouk's notification sound.
 *
 * VS Code exposes no "the other agent's turn ended" event, so we infer it from
 * the side-effect those agents share: they apply bursts of large, multi-line
 * edits to workspace files. We flag "agent-like" document changes, and once the
 * burst goes quiet for {@link SETTLE_MS}, fire the sound once.
 *
 * Normal human typing (a few characters at a time) stays below the thresholds,
 * and format-on-save churn is ignored via a short post-save guard.
 */
export class AgentActivityMonitor {
  /** A single change must insert/replace at least this many chars to count… */
  private static readonly SIZE_THRESHOLD = 80;
  /** …or span at least this many newlines (a multi-line block edit). */
  private static readonly NEWLINE_THRESHOLD = 2;
  /** Quiet period after the last agent-like edit before we call the burst done. */
  private static readonly SETTLE_MS = 2500;
  /** Ignore edits this soon after a save — that's format-on-save, not an agent. */
  private static readonly SAVE_GUARD_MS = 1200;

  private settleTimer: ReturnType<typeof setTimeout> | undefined;
  private burstActive = false;
  private lastSaveAt = 0;

  constructor(
    context: vscode.ExtensionContext,
    private readonly post: (msg: unknown) => void,
  ) {
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument(() => { this.lastSaveAt = Date.now(); }),
      vscode.workspace.onDidChangeTextDocument((e) => this.handleChange(e)),
      { dispose: () => { if (this.settleTimer) clearTimeout(this.settleTimer); } },
    );
  }

  private enabled(): boolean {
    return vscode.workspace.getConfiguration('genouk').get<boolean>('agentDoneSound', true);
  }

  private handleChange(e: vscode.TextDocumentChangeEvent): void {
    if (!this.enabled()) return;
    // Only real files — skip output panels, git/scm views, the terminal, etc.
    if (e.document.uri.scheme !== 'file') return;
    // Undo/redo can produce big diffs that aren't the agent producing new work.
    if (e.reason === vscode.TextDocumentChangeReason.Undo || e.reason === vscode.TextDocumentChangeReason.Redo) return;
    // Format-on-save rewrites the whole file — don't mistake it for an agent.
    if (Date.now() - this.lastSaveAt < AgentActivityMonitor.SAVE_GUARD_MS) return;

    let inserted = 0;
    let replaced = 0;
    let newlines = 0;
    for (const c of e.contentChanges) {
      inserted += c.text.length;
      replaced += c.rangeLength;
      for (let i = 0; i < c.text.length; i++) {
        if (c.text.charCodeAt(i) === 10 /* \n */) newlines++;
      }
    }

    const agentLike =
      inserted >= AgentActivityMonitor.SIZE_THRESHOLD ||
      replaced >= AgentActivityMonitor.SIZE_THRESHOLD ||
      newlines >= AgentActivityMonitor.NEWLINE_THRESHOLD;
    if (!agentLike) return;

    // Log the start of a burst (not every edit) so the output channel shows the
    // detector is alive without drowning in noise.
    if (!this.burstActive) {
      log(`Agent-like edit detected in ${vscode.workspace.asRelativePath(e.document.uri)} (+${inserted} chars, ${newlines} newlines) — waiting for it to settle.`);
    }

    // Within a burst we just keep pushing the settle deadline forward; the sound
    // fires once, SETTLE_MS after the final edit lands.
    this.burstActive = true;
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => this.fire(), AgentActivityMonitor.SETTLE_MS);
  }

  private fire(): void {
    this.settleTimer = undefined;
    if (!this.burstActive) return;
    this.burstActive = false;
    log('Agent edit burst settled — playing notification.');
    // OS sound is the reliable path; the webview chime is a bonus when the
    // panel is open and audio has been unlocked.
    playSystemNotification();
    this.post({ type: 'playSFX', value: 'notification' });
  }
}
