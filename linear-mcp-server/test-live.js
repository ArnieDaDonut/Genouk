import { LinearClient } from "@linear/sdk";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
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
  console.error("Could not load .env:", e.message);
}

const apiKey = process.env.LINEAR_API_KEY;
const teamId = process.env.LINEAR_API_TEAM_ID;

console.log(`Using Team ID: ${teamId}`);
console.log(`Using API Key (first 10 chars): ${apiKey ? apiKey.substring(0, 10) + "..." : "undefined"}`);

async function testConnection() {
  if (!apiKey || !teamId) {
    throw new Error("Missing LINEAR_API_KEY or LINEAR_API_TEAM_ID in env.");
  }
  const client = new LinearClient({ apiKey });
  console.log("Connecting to Linear...");
  const teams = await client.teams();
  console.log("Found teams:");
  teams.nodes.forEach(t => {
    console.log(`- Name: ${t.name}, Key: ${t.key}, ID: ${t.id}`);
  });
  
  const team = teams.nodes.find(
    t => t.key.toLowerCase() === teamId.toLowerCase() || t.id === teamId
  );
  if (!team) {
    console.log(`Could not find team matching: ${teamId}`);
  } else {
    console.log(`Successfully matched team: ${team.name} (${team.key})`);
  }
}

testConnection().catch(err => {
  console.error("Live connection test failed:", err);
});
