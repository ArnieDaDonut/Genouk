import * as vscode from 'vscode';
import { log } from '../log';

/**
 * Owns the live-tour navigation: the editor spotlight decoration, jumping to a
 * file + symbol, and the next/previous/play context wiring. Pulled out of the
 * sidebar provider so the message router stays thin and this stays testable in
 * isolation.
 */
export class TourNavigator {
  // Spotlight used by the live tour to highlight a symbol; cleared on a timer.
  // Deliberately bold: whole-line warm wash, a thick accent bar in the gutter,
  // and a full-height marker on the overview ruler so it's impossible to miss.
  private readonly highlight = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: 'rgba(255, 184, 0, 0.20)',
    borderWidth: '0 0 0 4px',
    borderStyle: 'solid',
    borderColor: new vscode.ThemeColor('focusBorder'),
    overviewRulerColor: 'rgba(255, 184, 0, 0.9)',
    overviewRulerLane: vscode.OverviewRulerLane.Full,
  });
  private clearTimer?: ReturnType<typeof setTimeout>;

  constructor(
    context: vscode.ExtensionContext,
    private readonly post: (msg: unknown) => void,
  ) {
    context.subscriptions.push(this.highlight);
  }

  next(): void {
    this.post({ type: 'tourStepDelta', value: 1 });
  }

  previous(): void {
    this.post({ type: 'tourStepDelta', value: -1 });
  }

  async setPlaying(playing: boolean): Promise<void> {
    await vscode.commands.executeCommand('setContext', 'genouk.liveTour', playing);
  }

  /** Open a workspace-relative file path in the editor (best-effort). */
  async openFile(relPath: string): Promise<void> {
    if (!relPath) return;
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) return;
    try {
      const uri = vscode.Uri.joinPath(folders[0].uri, relPath);
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, { preview: true });
    } catch {
      vscode.window.showWarningMessage(`Genouk: couldn't open ${relPath}`);
    }
  }

  /**
   * Open a file and spotlight a symbol inside it: select it, scroll it to the
   * center, and paint a fading highlight. Used by the live tour to "point at"
   * the function each stop is about. Falls back to a plain text match, then to
   * just opening the file if the symbol can't be located.
   */
  async revealInFile(relPath: string, symbol?: string): Promise<void> {
    if (!relPath) return;
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) return;

    let editor: vscode.TextEditor;
    let doc: vscode.TextDocument;
    try {
      const uri = vscode.Uri.joinPath(folders[0].uri, relPath);
      doc = await vscode.workspace.openTextDocument(uri);
      editor = await vscode.window.showTextDocument(doc, { preview: true });
    } catch {
      vscode.window.showWarningMessage(`Genouk: couldn't open ${relPath}`);
      return;
    }

    let range: vscode.Range | undefined;
    let how = 'none';
    const sym = symbol?.trim();
    if (sym) {
      const viaSymbols = await this.findSymbolRange(doc.uri, sym);
      if (viaSymbols) { range = viaSymbols; how = 'symbol-provider'; }
      else {
        const viaText = this.findTextRange(doc, sym);
        if (viaText) { range = viaText; how = 'text-search'; }
      }
    }

    if (range) {
      const line = range.start.line;
      const lineRange = new vscode.Range(line, 0, range.end.line, doc.lineAt(range.end.line).text.length);
      editor.selection = new vscode.Selection(range.start, range.end);
      editor.revealRange(lineRange, vscode.TextEditorRevealType.InCenter);
      editor.setDecorations(this.highlight, [lineRange]);
      if (this.clearTimer) clearTimeout(this.clearTimer);
      this.clearTimer = setTimeout(() => editor.setDecorations(this.highlight, []), 7000);
      log(`Reveal: ${relPath} → "${sym}" via ${how} at line ${line + 1}.`);
    } else {
      editor.revealRange(new vscode.Range(0, 0, 0, 0), vscode.TextEditorRevealType.AtTop);
      log(`Reveal: ${relPath} → symbol "${sym ?? ''}" NOT found; opened at top.`);
    }
  }

  /**
   * Ask the language server for the symbol's location (most accurate). Retries a
   * couple of times because the provider is often not ready the instant a file is
   * first opened (language server warm-up).
   */
  private async findSymbolRange(uri: vscode.Uri, name: string): Promise<vscode.Range | undefined> {
    const needle = name.replace(/^(class|function|const|interface|enum|type)\s+/i, '').toLowerCase();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
          'vscode.executeDocumentSymbolProvider', uri,
        );
        if (symbols && symbols.length > 0) {
          const found = this.searchSymbols(symbols, needle);
          if (found) return found.selectionRange ?? found.range;
          return undefined; // provider ready but no match — text search will handle it
        }
      } catch {
        /* retry */
      }
      await new Promise((r) => setTimeout(r, 350));
    }
    return undefined;
  }

  private searchSymbols(symbols: vscode.DocumentSymbol[], needle: string): vscode.DocumentSymbol | undefined {
    // Prefer an exact name match anywhere in the tree, else a contains-match.
    let contains: vscode.DocumentSymbol | undefined;
    const visit = (list: vscode.DocumentSymbol[]): vscode.DocumentSymbol | undefined => {
      for (const s of list) {
        const n = s.name.toLowerCase();
        if (n === needle) return s;
        if (!contains && n.includes(needle)) contains = s;
        if (s.children?.length) {
          const hit = visit(s.children);
          if (hit) return hit;
        }
      }
      return undefined;
    };
    return visit(symbols) ?? contains;
  }

  /** Last-resort: find the literal identifier text in the document. */
  private findTextRange(doc: vscode.TextDocument, name: string): vscode.Range | undefined {
    const bare = name.replace(/^(class|function|const|interface|enum|type)\s+/i, '').trim();
    const text = doc.getText();
    const idx = text.search(new RegExp(`\\b${bare.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`));
    if (idx < 0) return undefined;
    return new vscode.Range(doc.positionAt(idx), doc.positionAt(idx + bare.length));
  }
}
