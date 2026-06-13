import * as vscode from 'vscode';
import { AIProvider } from './AIProvider';
import * as cp from 'child_process';
import * as util from 'util';

const exec = util.promisify(cp.exec);

export class ChangeReviewer {
  async reviewChanges(): Promise<string> {
    const ai = AIProvider.getInstance();
    
    // Get git diff
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error('No workspace folder open to check diff.');
    }

    const cwd = workspaceFolders[0].uri.fsPath;
    let diffOutput = '';
    try {
      const { stdout } = await exec('git diff', { cwd });
      diffOutput = stdout;
    } catch (e) {
      throw new Error('Failed to get git diff. Are you in a git repository?');
    }

    if (!diffOutput.trim()) {
      return "No uncommitted changes found. Please make changes before requesting a review.";
    }

    const systemPrompt = `You are an expert code reviewer. Review the following git diff.
Check for bugs, edge cases, and ensure best practices.
Provide a concise, helpful review.`;

    const query = `${systemPrompt}\n\nDiff:\n${diffOutput}`;
    const resultText = await ai.generateContent(query);
    return resultText;
  }
}
