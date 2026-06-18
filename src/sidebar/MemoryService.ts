import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
  recentDigests,
  deleteDigest as deleteStoredDigest,
  clearDigests,
  syncCarryoverFile,
  loadFacts,
  deleteFact as deleteStoredFact,
  clearFacts,
  MEMORY_BLOCK_START,
} from '../memory/sessionMemoryStore';

/**
 * Everything the Memory tab needs: reading cross-chat digests, wiring the bundled
 * genouk-memory MCP server into the repo's `.mcp.json`, AND syncing the carry-over
 * briefing into a managed block in CLAUDE.md so a fresh agent chat auto-loads it
 * without having to call any MCP tool. Cohesive enough to live on its own rather
 * than bloating the sidebar message router.
 */
export class MemoryService {
  constructor(private readonly extensionUri: vscode.Uri) { }

  /** Absolute path of the first workspace folder, or null if none is open. */
  private repoRoot(): string | null {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
  }

  /** Filesystem path to the bundled MCP server the agent will spawn. */
  private mcpServerPath(): string {
    return vscode.Uri.joinPath(this.extensionUri, 'dist', 'mcpServer.js').fsPath;
  }

  /** Filesystem path to the bundled auto-save Stop hook the agent will run on each turn end. */
  private hookScriptPath(): string {
    return vscode.Uri.joinPath(this.extensionUri, 'dist', 'stopHook.js').fsPath;
  }

  /** The shell command Claude Code runs for the auto-save Stop hook. */
  private hookCommand(): string {
    return `node "${this.hookScriptPath()}"`;
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

  /** Absolute path of the CLAUDE.md that carries the auto-loaded memory block. */
  private memoryFilePath(repoRoot: string): string {
    return path.join(repoRoot, 'CLAUDE.md');
  }

  /** True when the managed carry-over block is present in CLAUDE.md. */
  private memoryBlockPresent(repoRoot: string): boolean {
    try {
      return fs.readFileSync(this.memoryFilePath(repoRoot), 'utf8').includes(MEMORY_BLOCK_START);
    } catch {
      return false;
    }
  }

  /** Assemble everything the Memory tab needs. */
  getMemoryData() {
    const repoRoot = this.repoRoot();
    // Refresh the CLAUDE.md block before reporting status, so the tab's "synced"
    // indicator reflects the current digests (the write is a no-op when unchanged).
    this.syncMemoryFile();
    return {
      digests: repoRoot ? recentDigests(repoRoot, 25) : [],
      facts: repoRoot ? loadFacts(repoRoot) : [],
      mcpConfig: repoRoot ? this.mcpConfigJson(repoRoot) : '',
      mcpConfigPath: repoRoot ? path.join(repoRoot, '.mcp.json') : null,
      configWritten: repoRoot ? this.isConfigWritten(repoRoot) : false,
      memoryFilePath: repoRoot ? this.memoryFilePath(repoRoot) : null,
      memoryFileWritten: repoRoot ? this.memoryBlockPresent(repoRoot) : false,
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
   * Merge the auto-save Stop hook into the repo's .claude/settings.json without clobbering
   * permissions or other hooks. The hook runs on every turn end and records what the current
   * chat is about (keyed by session id), so the "last chat" pointer actually advances WITHOUT
   * depending on the agent remembering to call save_context. Returns true if the file changed.
   */
  private mergeStopHook(repoRoot: string): boolean {
    const dir = path.join(repoRoot, '.claude');
    const file = path.join(dir, 'settings.json');
    let config: any = {};
    try {
      config = JSON.parse(fs.readFileSync(file, 'utf8')) || {};
    } catch {
      config = {};
    }
    if (!config.hooks || typeof config.hooks !== 'object') config.hooks = {};
    if (!Array.isArray(config.hooks.Stop)) config.hooks.Stop = [];

    const desired = this.hookCommand();
    const isOurs = (entry: any) =>
      Array.isArray(entry?.hooks) && entry.hooks.some((h: any) => typeof h?.command === 'string' && h.command.includes('stopHook.js'));

    // Already wired to the exact command → nothing to do (avoids needless writes/git noise).
    const existing = config.hooks.Stop.filter(isOurs);
    if (existing.length === 1 && existing[0].hooks.length === 1 && existing[0].hooks[0].command === desired) {
      return false;
    }

    // Drop any prior Genouk hook entries (self-heals a changed extension path), then add ours.
    config.hooks.Stop = config.hooks.Stop.filter((e: any) => !isOurs(e));
    config.hooks.Stop.push({ hooks: [{ type: 'command', command: desired }] });

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n', 'utf8');
    return true;
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
    try {
      // Register the auto-save Stop hook so chats get recorded without the agent having to
      // call save_context — this is what keeps the "last chat" carry-over actually current.
      this.mergeStopHook(repoRoot);
    } catch {
      /* best-effort: recall still works; only the automatic save side is degraded */
    }
    // Refresh the CLAUDE.md carry-over block too, so a fresh agent chat auto-loads the
    // latest memory even if it never connects the MCP server.
    this.syncMemoryFile();
  }

  /**
   * Refresh the managed carry-over block in the repo's CLAUDE.md so a fresh agent chat
   * auto-loads the latest memory — the text-file path to cross-chat carry-over, with zero
   * tool calls. Delegates to the vscode-free store writer (also used by the MCP server, so
   * the file stays current the instant a session is saved). Best-effort: never throws.
   */
  syncMemoryFile(): void {
    const repoRoot = this.repoRoot();
    if (repoRoot) syncCarryoverFile(repoRoot);
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
    if (repoRoot && id) { deleteStoredDigest(repoRoot, id); this.syncMemoryFile(); }
  }

  /** Forget a single remembered fact by id (no-op if no repo is open). */
  deleteFact(id: string): void {
    const repoRoot = this.repoRoot();
    if (repoRoot && id) { deleteStoredFact(repoRoot, id); this.syncMemoryFile(); }
  }

  /** Clear all stored digests AND facts for the active repo. */
  clearAll(): void {
    const repoRoot = this.repoRoot();
    if (repoRoot) { clearDigests(repoRoot); clearFacts(repoRoot); this.syncMemoryFile(); }
  }
}

