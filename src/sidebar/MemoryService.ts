import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
  recentDigests,
  deleteDigest as deleteStoredDigest,
  clearDigests,
  renderCarryover,
  loadFacts,
  deleteFact as deleteStoredFact,
  clearFacts,
} from '../memory/sessionMemoryStore';

/** Markers fencing Genouk's auto-managed carry-over block inside CLAUDE.md. */
const MEMORY_START = '<!-- GENOUK:MEMORY:START -->';
const MEMORY_END = '<!-- GENOUK:MEMORY:END -->';

/**
 * Everything the Memory tab needs: reading cross-chat digests, wiring the bundled
 * genouk-memory MCP server into the repo's `.mcp.json`, AND syncing the carry-over
 * briefing into a managed block in CLAUDE.md so a fresh agent chat auto-loads it
 * without having to call any MCP tool. Cohesive enough to live on its own rather
 * than bloating the sidebar message router.
 */
export class MemoryService {
  constructor(private readonly extensionUri: vscode.Uri) {}

  /** Absolute path of the first workspace folder, or null if none is open. */
  private repoRoot(): string | null {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
  }

  /** Filesystem path to the bundled MCP server the agent will spawn. */
  private mcpServerPath(): string {
    return vscode.Uri.joinPath(this.extensionUri, 'dist', 'mcpServer.js').fsPath;
  }

  /** The genouk-memory entry for an agent's MCP config. */
  private mcpServerEntry(repoRoot: string) {
    return {
      command: 'node',
      args: [this.mcpServerPath()],
      env: { GENOUK_REPO: repoRoot },
    };
  }

  /** Pretty .mcp.json snippet to display / copy. */
  private mcpConfigJson(repoRoot: string): string {
    return JSON.stringify({ mcpServers: { 'genouk-memory': this.mcpServerEntry(repoRoot) } }, null, 2);
  }

  private isConfigWritten(repoRoot: string): boolean {
    try {
      const existing = JSON.parse(fs.readFileSync(path.join(repoRoot, '.mcp.json'), 'utf8'));
      return !!existing?.mcpServers?.['genouk-memory'];
    } catch {
      return false;
    }
  }

  /** Assemble everything the Memory tab needs. */
  getMemoryData() {
    const repoRoot = this.repoRoot();
    return {
      digests: repoRoot ? recentDigests(repoRoot, 25) : [],
      facts: repoRoot ? loadFacts(repoRoot) : [],
      mcpConfig: repoRoot ? this.mcpConfigJson(repoRoot) : '',
      mcpConfigPath: repoRoot ? path.join(repoRoot, '.mcp.json') : null,
      configWritten: repoRoot ? this.isConfigWritten(repoRoot) : false,
      repoLabel: repoRoot ? path.basename(repoRoot) : null,
    };
  }

  /**
   * Merge the genouk-memory server into the repo's .mcp.json without clobbering other servers.
   * Returns true if the file was changed. Shared by the explicit "Write" button and the silent
   * activation-time ensure.
   */
  private mergeConfig(repoRoot: string): boolean {
    const file = path.join(repoRoot, '.mcp.json');
    let config: any = {};
    try {
      config = JSON.parse(fs.readFileSync(file, 'utf8')) || {};
    } catch {
      config = {};
    }
    if (!config.mcpServers || typeof config.mcpServers !== 'object') config.mcpServers = {};

    const desired = this.mcpServerEntry(repoRoot);
    const existing = config.mcpServers['genouk-memory'];
    // Already correct (same server path + repo) → nothing to do. Avoids needless writes/git noise.
    if (existing && JSON.stringify(existing) === JSON.stringify(desired)) return false;

    config.mcpServers['genouk-memory'] = desired;
    fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n', 'utf8');
    return true;
  }

  /**
   * Write (or merge) the genouk-memory server into the repo's .mcp.json. Preserves any
   * other servers already configured there rather than clobbering the file.
   */
  writeConfig(): void {
    const repoRoot = this.repoRoot();
    if (!repoRoot) { vscode.window.showWarningMessage('Genouk: open a folder to connect the memory server.'); return; }
    try {
      const changed = this.mergeConfig(repoRoot);
      vscode.window.showInformationMessage(
        changed
          ? 'Genouk: wrote genouk-memory to .mcp.json. Restart your agent to pick it up.'
          : 'Genouk: .mcp.json is already connected to genouk-memory.',
      );
    } catch (err: any) {
      vscode.window.showErrorMessage(`Genouk: couldn't write .mcp.json — ${err?.message ?? err}`);
    }
  }

  /**
   * Ensure the repo's .mcp.json points at the bundled memory server, silently. Called on
   * activation so memory is connected out of the box — without this, the tools never load
   * into the agent and cross-chat recall simply never happens. Best-effort: never throws.
   */
  ensureConfig(): void {
    const repoRoot = this.repoRoot();
    if (!repoRoot) return;
    try {
      this.mergeConfig(repoRoot);
    } catch {
      /* best-effort: the Memory tab's "Write .mcp.json" button remains as a fallback */
    }
  }

  /** Path to the repo's CLAUDE.md, where the carry-over block is kept in sync. */
  private claudeMdPath(repoRoot: string): string {
    return path.join(repoRoot, 'CLAUDE.md');
  }

  /**
   * Write the current carry-over briefing into a managed `<!-- GENOUK:MEMORY -->` block in
   * CLAUDE.md. This is the text-file path to cross-chat memory: Claude Code (and similar
   * agents) auto-load CLAUDE.md every session, so the next chat sees prior decisions and open
   * threads with zero tool calls — no dependence on the agent remembering to call recall_context.
   *
   * Only the fenced block is touched; everything else in CLAUDE.md is preserved. If the file
   * doesn't exist yet it's created with just the block. Best-effort: never throws.
   */
  syncMemoryFile(): void {
    const repoRoot = this.repoRoot();
    if (!repoRoot) return;
    try {
      const block = `${MEMORY_START}\n${renderCarryover(repoRoot)}\n${MEMORY_END}`;
      const file = this.claudeMdPath(repoRoot);

      let existing = '';
      try { existing = fs.readFileSync(file, 'utf8'); } catch { /* file may not exist yet */ }

      let next: string;
      const start = existing.indexOf(MEMORY_START);
      const end = existing.indexOf(MEMORY_END);
      if (start !== -1 && end !== -1 && end > start) {
        // Replace the managed block in place, leaving the rest of the file untouched.
        next = existing.slice(0, start) + block + existing.slice(end + MEMORY_END.length);
      } else if (existing.trim()) {
        // File exists but has no block yet — append it at the end.
        next = existing.replace(/\s*$/, '') + `\n\n${block}\n`;
      } else {
        // No CLAUDE.md yet — create one carrying just the block.
        next = `${block}\n`;
      }

      if (next !== existing) fs.writeFileSync(file, next, 'utf8');
    } catch {
      /* best-effort: carry-over also remains available via the genouk-memory MCP recall tool */
    }
  }

  /** Copy the .mcp.json snippet to the clipboard. */
  async copyConfig(): Promise<void> {
    const repoRoot = this.repoRoot();
    if (!repoRoot) { vscode.window.showWarningMessage('Genouk: open a folder to connect the memory server.'); return; }
    await vscode.env.clipboard.writeText(this.mcpConfigJson(repoRoot));
    vscode.window.showInformationMessage('Genouk: MCP config copied to clipboard.');
  }

  /** Delete a single stored digest by id (no-op if no repo is open). */
  deleteDigest(id: string): void {
    const repoRoot = this.repoRoot();
    if (repoRoot && id) deleteStoredDigest(repoRoot, id);
  }

  /** Forget a single remembered fact by id (no-op if no repo is open). */
  deleteFact(id: string): void {
    const repoRoot = this.repoRoot();
    if (repoRoot && id) deleteStoredFact(repoRoot, id);
  }

  /** Clear all stored digests AND facts for the active repo. */
  clearAll(): void {
    const repoRoot = this.repoRoot();
    if (repoRoot) { clearDigests(repoRoot); clearFacts(repoRoot); }
  }
}
