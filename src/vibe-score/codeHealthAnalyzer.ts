import * as vscode from 'vscode';
import { HealthScore } from './types';
import { clamp } from '../shared/utils';

/**
 * Calculates a health score 0–100 based on:
 * - Diagnostic errors/warnings from all open files
 * - Git merge conflicts in the active file
 */
export async function calculateHealthScore(): Promise<HealthScore> {
  const allDiagnostics = vscode.languages.getDiagnostics();

  let errors = 0;
  let warnings = 0;
  let hints = 0;

  for (const [, diagnostics] of allDiagnostics) {
    for (const diag of diagnostics) {
      switch (diag.severity) {
        case vscode.DiagnosticSeverity.Error:       errors++;   break;
        case vscode.DiagnosticSeverity.Warning:     warnings++; break;
        case vscode.DiagnosticSeverity.Information:
        case vscode.DiagnosticSeverity.Hint:        hints++;    break;
      }
    }
  }

  // Check for Git conflict markers in the active document
  const hasGitConflicts = detectGitConflicts();

  // Score formula
  let score = 100;
  score -= Math.min(errors * 15, 60);
  score -= Math.min(warnings * 3, 20);
  score -= Math.min(hints * 1, 5);
  score -= hasGitConflicts ? 20 : 0;
  score = clamp(score, 0, 100);

  return { score, errors, warnings, hints, hasGitConflicts };
}

/** Check if the active file has Git conflict markers */
function detectGitConflicts(): boolean {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return false;
  const text = editor.document.getText();
  return text.includes('<<<<<<<') && text.includes('>>>>>>>');
}
