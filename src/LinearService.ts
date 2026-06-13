import { LinearClient } from '@linear/sdk';
import { SessionPlan } from './SessionPlanner';

export class LinearService {
  /**
   * Syncs the session plan tasks to Linear.
   * If a task doesn't have a linearIssueId, it creates a new issue in Linear.
   * Returns a modified SessionPlan with updated linearIssueIds and URLs.
   */
  static async syncPlanToLinear(plan: SessionPlan, apiKey: string, teamKeyOrId: string): Promise<SessionPlan> {
    const client = new LinearClient({ apiKey });
    
    // Find the team
    const teams = await client.teams();
    let team = teams.nodes.find(t => t.key.toLowerCase() === teamKeyOrId.toLowerCase() || t.id === teamKeyOrId);
    
    if (!team) {
      throw new Error(`Could not find Linear team matching: ${teamKeyOrId}`);
    }

    const updatedPlan: SessionPlan = { ...plan, tasks: [...plan.tasks] };

    for (let i = 0; i < updatedPlan.tasks.length; i++) {
      const task = updatedPlan.tasks[i];
      if (!task.linearIssueId) {
        // Create new issue
        const issuePayload = await client.createIssue({
          teamId: team.id,
          title: `[Genouk] ${task.title}`,
          description: task.description,
        });

        if (issuePayload.success) {
          const issue = await issuePayload.issue;
          if (issue) {
            updatedPlan.tasks[i] = {
              ...task,
              linearIssueId: issue.id,
              linearIssueUrl: issue.url
            };
          }
        }
      } else {
        // If it already has an ID, we might sync status here in the future
        // For now, we leave it as is to just support one-way creation
      }
    }

    return updatedPlan;
  }

  /**
   * Creates a Linear issue from a TODO comment.
   * Returns the issue identifier (e.g. ENG-123).
   */
  static async createIssueFromTodo(title: string, description: string, apiKey: string, teamKeyOrId: string): Promise<string> {
    const client = new LinearClient({ apiKey });
    
    const teams = await client.teams();
    let team = teams.nodes.find(t => t.key.toLowerCase() === teamKeyOrId.toLowerCase() || t.id === teamKeyOrId);
    
    if (!team) {
      throw new Error(`Could not find Linear team matching: ${teamKeyOrId}`);
    }

    const issuePayload = await client.createIssue({
      teamId: team.id,
      title: title.substring(0, 80), // Linear titles shouldn't be too long
      description: description,
    });

    if (issuePayload.success) {
      const issue = await issuePayload.issue;
      if (issue && issue.identifier) {
        return issue.identifier;
      }
    }
    
    throw new Error('Failed to create Linear issue.');
  }
}
