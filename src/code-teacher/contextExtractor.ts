import * as vscode from 'vscode';
import * as path from 'path';
import { ExplanationRequest } from './types';
import { getSurroundingContext, getWordAtPosition } from '../shared/utils';

/**
 * Extracts the code to explain and surrounding context from the active editor.
 * Prefers selection; falls back to the word at the cursor.
 */
export function extractContext(editor: vscode.TextEditor): ExplanationRequest | null {
  const document = editor.document;
  const selection = editor.selection;

  let selectedCode: string;
  let range: vscode.Range;

  if (!selection.isEmpty) {
    // User has highlighted text — use that
    selectedCode = document.getText(selection);
    range = selection;
  } else {
    // No selection — use the word at cursor
    const word = getWordAtPosition(document, selection.active);
    if (!word) return null;
    const wordRange = document.getWordRangeAtPosition(selection.active)!;
    selectedCode = word;
    range = wordRange;
  }

  const surroundingContext = getSurroundingContext(document, range, 20);

  return {
    selectedCode,
    surroundingContext,
    language: document.languageId,
    fileName: path.basename(document.fileName),
  };
}

/** Build the prompt to send to Gemini */
export function buildPrompt(req: ExplanationRequest): string {
  return `You are a senior software engineer and a patient teacher. Explain the following ${req.language} code to a developer.

FILE: ${req.fileName}

SELECTED CODE TO EXPLAIN:
\`\`\`${req.language}
${req.selectedCode}
\`\`\`

SURROUNDING CONTEXT (for reference only):
\`\`\`${req.language}
${req.surroundingContext}
\`\`\`

Respond in this exact markdown format:

## 📝 Summary
One clear sentence explaining what this code does.

## 🔍 Detailed Explanation
A thorough explanation covering what each part does and why, written for a developer who might not know this codebase.

## ⚠️ Gotchas & Side Effects
Any non-obvious behaviors, edge cases, or things a developer should watch out for when modifying this code.

## 📊 Complexity
Time and space complexity if relevant (e.g. O(n log n) time, O(n) space). Write "N/A" if not applicable.

Keep the tone friendly, clear, and educational. Use code snippets in your explanation when helpful.`;
}
