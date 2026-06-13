import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { LinearClient } from "@linear/sdk";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load local .env file on startup if it exists
try {
  const envContent = await fs.readFile(path.join(__dirname, ".env"), "utf-8");
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.substring(0, idx).trim();
        const value = trimmed.substring(idx + 1).trim().replace(/^['"]|['"]$/g, "");
        process.env[key] = value;
      }
    }
  }
} catch (e) {
  // Ignore if .env doesn't exist
}

// Initialize the MCP server
const server = new McpServer({

  name: "linear-mcp-server",
  version: "1.0.0",
});

// Register the sync_todos_to_linear tool
server.tool(
  "sync_todos_to_linear",
  "Scans a file for unsynced TODO and FIXME comments, creates Linear issues for them, and writes the issue keys back to the file.",
  {
    filePath: z.string().describe("The absolute path of the file to scan and sync."),
    apiKey: z.string().optional().describe("Linear Personal API Key. Defaults to LINEAR_API_KEY environment variable."),
    teamId: z.string().optional().describe("Linear Team ID or Key (e.g. 'ENG'). Defaults to LINEAR_API_TEAM_ID environment variable.")
  },
  async ({ filePath, apiKey, teamId }) => {
    const finalApiKey = apiKey || process.env.LINEAR_API_KEY;
    const finalTeamId = teamId || process.env.LINEAR_API_TEAM_ID;

    // Log call arguments to a debug file
    try {
      await fs.appendFile(
        path.join(__dirname, "debug.log"),
        `[${new Date().toISOString()}] Called with: filePath="${filePath}", apiKey="${apiKey ? 'provided' : 'not-provided'}", teamId="${teamId}" | finalApiKey="${finalApiKey ? 'exists' : 'missing'}", finalTeamId="${finalTeamId}"\n`,
        "utf-8"
      );
    } catch (logErr) {
      console.error("Failed to write to debug log:", logErr);
    }

    if (!finalApiKey) {
      return {
        isError: true,
        content: [{ type: "text", text: "Error: Linear API Key is required. Please set the LINEAR_API_KEY environment variable or pass apiKey in arguments." }]
      };
    }


    if (!finalTeamId) {
      return {
        isError: true,
        content: [{ type: "text", text: "Error: Linear Team ID/Key is required. Please set the LINEAR_API_TEAM_ID environment variable or pass teamId in arguments." }]
      };
    }

    try {
      // Check if file exists and read its contents
      try {
        await fs.access(filePath);
      } catch {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: File not found at ${filePath}` }]
        };
      }

      const fileContent = await fs.readFile(filePath, "utf-8");
      const lineEnding = fileContent.includes("\r\n") ? "\r\n" : "\n";
      const lines = fileContent.split(/\r?\n/);
      
      // Group 1: Prefix and keyword (e.g. "// TODO" or "# FIXME")
      // Group 2: Prefix (e.g. "//" or "#")
      // Group 3: Keyword (TODO or FIXME)
      // Negative lookahead: ensures it doesn't already have an issue key like [ENG-123]
      // Group 4: Separator (e.g. ": " or " ")
      // Group 5: The comment text
      const regex = /((\/\/|\/\*|#)\s*(TODO|FIXME))(?!\s*:?\s*\[[A-Z]+-\d+\])(:?\s*)(.*)/i;
      
      let modified = false;
      const syncedIssues = [];
      
      // Initialize Linear client
      const client = new LinearClient({ apiKey: finalApiKey });
      let team = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(regex);
        
        try {
          await fs.appendFile(
            path.join(__dirname, "debug.log"),
            `  Line ${i + 1}: "${line}" | Match: ${match ? "YES" : "NO"}\n`,
            "utf-8"
          );
        } catch {}

        if (match) {

          const type = match[3].toUpperCase(); // TODO or FIXME
          let commentText = match[5].trim();
          
          // Clean up trailing block comment characters if they exist (e.g. "*/")
          if (commentText.endsWith("*/")) {
            commentText = commentText.slice(0, -2).trim();
          }

          if (!commentText) {
            continue; // Skip empty TODOs
          }

          // Lazily resolve team on first match to avoid unnecessary network calls
          if (!team) {
            try {
              const teams = await client.teams();
              team = teams.nodes.find(
                t => t.key.toLowerCase() === finalTeamId.toLowerCase() || t.id === finalTeamId
              );
              
              if (!team) {
                return {
                  isError: true,
                  content: [{ type: "text", text: `Error: Could not find Linear team matching '${finalTeamId}'` }]
                };
              }
            } catch (err) {
              return {
                isError: true,
                content: [{ type: "text", text: `Error connecting to Linear API: ${err.message}` }]
              };
            }
          }

          const fileName = path.basename(filePath);
          const issueTitle = `[Genouk] ${type} in ${fileName}`;
          const issueDescription = `${commentText}\n\nFile: \`${filePath}\`\nLine: ${i + 1}`;

          try {
            const issuePayload = await client.createIssue({
              teamId: team.id,
              title: issueTitle.substring(0, 80),
              description: issueDescription,
            });

            if (issuePayload.success) {
              const issue = await issuePayload.issue;
              if (issue && issue.identifier) {
                const issueKey = issue.identifier;
                const replacementSeparator = match[4] || ": ";
                const replacementText = `${match[1]} [${issueKey}]${replacementSeparator}${match[5]}`;
                
                lines[i] = line.replace(regex, replacementText);
                modified = true;
                
                syncedIssues.push({
                  key: issueKey,
                  title: commentText,
                  line: i + 1,
                  url: issue.url
                });
              }
            } else {
              console.error(`Failed to create issue for line ${i + 1}`);
            }
          } catch (issueErr) {
            console.error(`Error creating Linear issue at line ${i + 1}:`, issueErr);
          }
        }
      }

      if (modified) {
        await fs.writeFile(filePath, lines.join(lineEnding), "utf-8");
        return {
          content: [
            {
              type: "text",
              text: `Successfully synced ${syncedIssues.length} TODO(s) to Linear:\n` +
                    syncedIssues.map(issue => `- **${issue.key}** (Line ${issue.line}): "${issue.title}" -> ${issue.url}`).join("\n")
            }
          ]
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: "No unsynced TODOs or FIXMEs found in the file."
            }
          ]
        };
      }

    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `Internal server error: ${err.message}` }]
      };
    }
  }
);

// Connect to stdio transport
const transport = new StdioServerTransport();
server.connect(transport).catch(error => {
  console.error("Failed to connect transport:", error);
});
