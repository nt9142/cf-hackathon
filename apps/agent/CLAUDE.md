# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

- `pnpm install` - Install dependencies (preferred package manager)
- `pnpm start` - Start development server with hot reload
- `pnpm deploy` - Build and deploy to Cloudflare Workers
- `pnpm test` - Run tests with Vitest
- `pnpm run types` - Generate Wrangler types
- `pnpm run format` - Format code with Prettier
- `pnpm run check` - Run full checks (prettier, biome lint, typescript)

## Environment Setup

The application requires a `.dev.vars` file in the root directory with:

```
GOOGLE_GENERATIVE_AI_API_KEY=your-key-goes-here
```

For production deployment, upload secrets using:

```bash
wrangler secret bulk .dev.vars
```

## Architecture Overview

This is a Cloudflare Workers-based AI chat agent built with:

- **Frontend**: React with Vite, TypeScript, and Tailwind CSS
- **Backend**: Cloudflare Workers with Durable Objects for state persistence
- **AI Model**: Google Generative AI (Gemini 2.5 Flash) via ai-sdk
- **Agent Framework**: Cloudflare Agents package with MCP server support
- **Observability**: Fiberplane AI Agent Playground (available at `/fp` endpoint)

### Key Files

- `src/server.ts` - Main chat agent implementation extending `AIChatAgent`
- `src/tools.ts` - Tool definitions for the AI agent (both auto-execute and confirmation-required)
- `src/app.tsx` - React frontend for the chat interface
- `src/utils.ts` - Utility functions for tool processing
- `wrangler.jsonc` - Cloudflare Workers configuration

### Agent System

The agent uses a two-tier tool system:

1. **Auto-execute tools** - Run immediately without user confirmation (e.g., `getLocalTime`, `scheduleTask`)
2. **Confirmation-required tools** - Require human approval before execution (e.g., `getWeatherInformation`)

Tools requiring confirmation are defined without an `execute` function and have their implementations in the `executions` object in `tools.ts`.

### MCP Server Integration

The agent supports dynamic MCP (Model Context Protocol) server management:

- Add/remove MCP servers at runtime
- Automatic tool discovery from connected MCP servers
- Memory management for agent state persistence

### Scheduling System

Built-in task scheduling supports:

- One-time scheduled tasks (specific date/time)
- Delayed tasks (execute after X seconds)
- Recurring tasks (cron patterns)

## Development Notes

- The application uses Durable Objects for state persistence
- Fiberplane instrumentation provides detailed agent monitoring
- The UI supports both light and dark themes
- All tool calls are logged and can be inspected via the Fiberplane playground
- The agent maintains conversation history and memory across sessions
