# Genouk

An AI-powered VS Code extension used to accelerate programmer workflows. AI Assistant to generate better prompts, provide tours of new repositories, plant out complex tasks, and sync your to-do list directly to Linear.

## Features

AI Prompt Reviewer - Integrated with Vultr, reviews and rewrites your prompts with context from your repository.

Repository Tours - Automatically reads and creates tours and interactive stops from files within the repository to help you quickly understand an unfamiliar repository.

Session Planner - A popout planner window that generates a structured to-do list that can also be synced straight to your Linear account.

Cross-Chat Memory - Genouk stores information with chats in Claude Code, ensuring no information is lost between sessions.

## Architecture

1. **Extension** The VS Code extension and a React webview app.

2. **Linear MCP Server** An MCP server process to handle Linear issue creation.

The popour and sidebar share the same UI and React webview.

## Prerequisites

- Node.js
- A Linear account with an API Key & Team ID

##Local Setup

1. **Clone the repository**

git clone https://github.com/ArnieDaDonut/Genouk

cd genouk

2. Install Dependencies

npm install
cd linear-mcp-server
npm install
cd ..

4. Environment Variables

Create a .env file in the linear-mcp-server/ directory and enter:

LINEAR_API_KEY=your_linear_api_key_here
LINEAR_API_TEAM_ID=your_linear_team_id_here

5. Run the Extension using npm run dev, then F5.

## AI Usage

AI was used to:
- Set up the architecture of files.
- Understanding how to and what is needed to make the extension.
- Write complex features such as the Cross-Chat memory.
- Research purposes to find what API's to use and how to integrate them.

Made By:
Arnav, Jeevithan, and Rohan