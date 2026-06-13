import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function killOldServer() {
  const { stdout } = await execAsync("ps aux");
  const lines = stdout.split("\n");
  let killedCount = 0;
  for (const line of lines) {
    if (line.includes("linear-mcp-server/index.js") && !line.includes("restart-server.js")) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[1];
      if (pid) {
        console.log(`Found running server process: PID ${pid}. Sending SIGTERM...`);
        try {
          process.kill(parseInt(pid), "SIGTERM");
          killedCount++;
        } catch (e) {
          console.error(`Failed to kill process ${pid}:`, e.message);
        }
      }
    }
  }
  if (killedCount === 0) {
    console.log("No running linear-mcp-server/index.js processes found.");
  } else {
    console.log(`Successfully terminated ${killedCount} process(es).`);
  }
}

killOldServer().catch(console.error);
