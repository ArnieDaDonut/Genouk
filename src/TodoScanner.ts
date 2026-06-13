import * as vscode from 'vscode';

export interface UnsyncedTodo {
  range: vscode.Range;
  type: 'TODO' | 'FIXME';
  text: string;
  match1: string; // The prefix + keyword, e.g. "// TODO"
  match4: string; // The separator, e.g. ": "
  match5: string; // The actual comment text
}

export class TodoScanner {
  /**
   * Scans a document for unsynced TODO or FIXME comments.
   * Matches comments starting with //, /*, or #
   * Ignores comments that already have an issue key like [ENG-123]
   */
  static scanDocument(document: vscode.TextDocument): UnsyncedTodo[] {
    const todos: UnsyncedTodo[] = [];
    const text = document.getText();
    
    // Group 1: Prefix and keyword (e.g. "// TODO")
    // Group 2: Prefix (e.g. "//")
    // Group 3: Keyword (TODO or FIXME)
    // Negative lookahead: ensures it doesn't already have an issue key like [ENG-123]
    // Group 4: Separator (e.g. ": " or " ")
    // Group 5: The comment text
    const regex = /((\/\/|\/\*|#)\s*(TODO|FIXME))(?!\s*:?\s*\[[A-Z]+-\d+\])(:?\s*)(.*)/ig;

    let match;
    while ((match = regex.exec(text)) !== null) {
      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + match[0].length);
      
      const type = match[3].toUpperCase() as 'TODO' | 'FIXME';
      const commentText = match[5].trim();

      // Only capture if there's actual text
      if (commentText) {
        todos.push({
          range: new vscode.Range(startPos, endPos),
          type,
          text: commentText,
          match1: match[1],
          match4: match[4],
          match5: match[5]
        });
      }
    }

    return todos;
  }
}
