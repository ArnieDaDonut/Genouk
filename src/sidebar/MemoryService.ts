import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
  recentDigests,
  deleteDigest as deleteStoredDigest,
  clearDigests,
} from '../memory/sessionMemoryStore';

/**
 * Everything the Memory tab needs: reading cross-chat digests and wiring the
 * bundled genouk-memory MCP server into the repo's `.mcp.json`. Cohesive enough
 * to live on its own rather than bloating the sidebar message router.
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

  /** Clear all stored digests for the active repo. */
  clearAll(): void {
    const repoRoot = this.repoRoot();
    if (repoRoot) clearDigests(repoRoot);
  }
}
