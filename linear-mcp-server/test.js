import fs from "fs/promises";
import path from "path";

async function runTest() {
  const filePath = path.resolve("./test-todo-file.txt");
  console.log(`Testing file scanning & modification on: ${filePath}`);

  const fileContent = await fs.readFile(filePath, "utf-8");
  const lineEnding = fileContent.includes("\r\n") ? "\r\n" : "\n";
  const lines = fileContent.split(/\r?\n/);
  
  const regex = /((\/\/|\/\*|#)\s*(TODO|FIXME))(?!\s*:?\s*\[[A-Z]+-\d+\])(:?\s*)(.*)/i;
  
  let modified = false;
  const syncedIssues = [];
  let mockIdCounter = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(regex);
    
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

      // Mock Linear ID generation
      const issueKey = `TST-${mockIdCounter++}`;
      const replacementSeparator = match[4] || ": ";
      const replacementText = `${match[1]} [${issueKey}]${replacementSeparator}${match[5]}`;
      
      lines[i] = line.replace(regex, replacementText);
      modified = true;
      
      syncedIssues.push({
        key: issueKey,
        title: commentText,
        line: i + 1,
      });
    }
  }

  if (modified) {
    const output = lines.join(lineEnding);
    console.log("\n--- File Content After Scanning & Replacing ---");
    console.log(output);
    console.log("----------------------------------------------\n");
    
    console.log(`Synced issues:`, syncedIssues);
    
    // Write changes back to the test file to confirm file writing works
    await fs.writeFile(filePath, output, "utf-8");
    console.log("\nSuccess: Test file successfully modified and written.");
  } else {
    console.log("No unsynced TODOs or FIXMEs found.");
  }
}

runTest().catch(err => {
  console.error("Test failed:", err);
});
