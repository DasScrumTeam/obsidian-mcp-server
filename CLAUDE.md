# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **Obsidian MCP Server** - a Model Context Protocol server that provides AI agents and development tools with comprehensive access to Obsidian vaults through the Obsidian Local REST API plugin. The server exposes vault operations as standardized MCP tools for reading, writing, searching, and managing notes.

Built using TypeScript and the `@modelcontextprotocol/sdk`, this server bridges AI workflows with Obsidian knowledge management.

## Development Commands

### Core Development
```bash
# Install dependencies
npm install

# Clean build (removes dist/ and rebuilds)
npm run rebuild

# Build only (compile TypeScript)
npm run build

# Format code
npm run format
```

### Running the Server
```bash
# Start with stdio transport (default)
npm start
npm run start:stdio

# Start with HTTP transport
npm run start:http

# Generate documentation
npm run docs:generate
```

### Testing & Inspection
```bash
# Test server capabilities with MCP Inspector
npm run inspect
npm run inspect:stdio
npm run inspect:http

# Fetch OpenAPI spec from Obsidian API
npm run fetch:spec
```

## Architecture Overview

### Core Structure
- **Entry Point**: `src/index.ts` - Server initialization, shared service management, graceful shutdown
- **MCP Server Core**: `src/mcp-server/server.ts` - Server instance creation, tool registration, transport selection
- **Configuration**: `src/config/index.ts` - Environment validation, project root discovery, config management
- **Services Layer**: `src/services/obsidianRestAPI/` - Typed client for Obsidian Local REST API with caching

### Tool Architecture Pattern
Each MCP tool follows a consistent modular structure in `src/mcp-server/tools/`:
```
toolName/
├── index.ts        # Main export and tool registration
├── registration.ts # MCP tool definition and schema
└── logic.ts        # Implementation logic
```

### Transport Architecture
Supports both **stdio** (single instance) and **HTTP** (per-session instances) transports:
- `src/mcp-server/transports/stdioTransport.ts` - Direct stdio communication
- `src/mcp-server/transports/httpTransport.ts` - HTTP server with SSE, authentication, CORS

### Services Architecture

#### ObsidianRestApiService (`src/services/obsidianRestAPI/`)
- Typed HTTP client for Obsidian Local REST API
- Organized methods in `methods/` directory by functionality
- Request/response validation using Zod schemas
- Error handling and retry logic

#### VaultCacheService (`src/services/obsidianRestAPI/vaultCache/`)
- In-memory cache of vault content for performance
- Background refresh with configurable intervals
- Fallback mechanism for search operations
- Proactive cache updates after modifications

## Configuration

### Required Environment Variables
- `OBSIDIAN_API_KEY` - API key from Obsidian Local REST API plugin
- `OBSIDIAN_BASE_URL` - Base URL (default: `http://127.0.0.1:27123`)

### Transport Configuration
- `MCP_TRANSPORT_TYPE` - "stdio" or "http" (default: "stdio")
- For HTTP: `MCP_HTTP_PORT`, `MCP_HTTP_HOST`, authentication settings

### Development Configuration
- `MCP_LOG_LEVEL` - Logging verbosity (default: "info")
- `OBSIDIAN_ENABLE_CACHE` - Enable vault caching (default: "true")
- `OBSIDIAN_VERIFY_SSL` - SSL verification (default: "false" for self-signed certs)

## MCP Tools Available

The server provides these standardized tools:
- `obsidian_read_note` - Read note content and metadata
- `obsidian_update_note` - Append, prepend, or overwrite note content
- `obsidian_search_replace` - Find and replace within notes
- `obsidian_global_search` - Search across entire vault
- `obsidian_list_notes` - List notes in directories
- `obsidian_manage_frontmatter` - YAML frontmatter management
- `obsidian_manage_tags` - Tag management (frontmatter and inline)
- `obsidian_delete_note` - Delete notes from vault

## Development Notes

### Error Handling
- Centralized error handling through `src/utils/internal/errorHandler.ts`
- Structured logging with request correlation via `src/utils/internal/requestContext.ts`
- Custom `McpError` types for standardized error responses

### Security Features
- Input validation/sanitization using Zod schemas
- Rate limiting capabilities
- Authentication strategies (JWT, OAuth 2.1) for HTTP transport
- CORS support for web integration

### Type Safety
- Comprehensive TypeScript coverage
- Zod schema validation for all inputs/outputs
- Global type definitions in `src/types-global/`

### Prerequisites for Development
1. **Node.js** >= 16.0.0
2. **Obsidian** with Local REST API plugin installed and configured
3. Valid API key from the plugin
4. TypeScript knowledge for development

### Testing MCP Integration
Use the included `mcp.json` configuration with MCP Inspector or integrate with MCP clients like Cline or Claude Desktop by configuring the server in their settings.