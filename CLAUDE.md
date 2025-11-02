# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **Obsidian MCP Server** - a Model Context Protocol server that provides AI agents and development tools with comprehensive access to Obsidian vaults through the Obsidian Local REST API plugin. The server exposes vault operations as standardized MCP tools for reading, writing, searching, and managing notes.

Built using TypeScript and the `@modelcontextprotocol/sdk`, this server bridges AI workflows with Obsidian knowledge management.

**Important Context**: This plugin is part of the AME3 Obsidian vault ecosystem. See the parent vault's CLAUDE.md for integration details and use cases.

## Development Commands

### Core Development
```bash
# Install dependencies
npm install

# Clean build (removes dist/ and rebuilds)
npm run rebuild

# Build only (compile TypeScript to dist/)
npm run build

# Format code with Prettier
npm run format
```

### Running the Server
```bash
# Start with stdio transport (default for MCP clients)
npm start
npm run start:stdio

# Start with HTTP transport (debugging/web integration)
npm run start:http

# Generate TypeDoc documentation
npm run docs:generate
```

### Testing & Inspection
```bash
# Test server capabilities with MCP Inspector (interactive testing)
npm run inspect
npm run inspect:stdio
npm run inspect:http

# Fetch OpenAPI spec from Obsidian Local REST API
npm run fetch:spec
```

## Architecture Overview

### Startup Sequence & Service Lifecycle

The server follows a strict initialization order to ensure reliability:

1. **Entry Point** (`src/index.ts`):
   - Loads environment variables via dotenv
   - Validates configuration using Zod schemas
   - Instantiates shared services (ObsidianRestApiService, VaultCacheService)
   - Performs retry-based Obsidian API health check
   - Starts selected transport (stdio or HTTP)
   - Registers signal handlers for graceful shutdown

2. **Server Initialization** (`src/mcp-server/server.ts`):
   - Creates McpServer instance with capabilities declaration
   - Registers all MCP tools with shared service dependencies
   - Different lifecycle for stdio (single instance) vs HTTP (per-session instances)

3. **Service Instantiation Pattern**:
   - Services are instantiated once in `src/index.ts` and passed down
   - Tools receive service references via dependency injection
   - For stdio: single shared instance
   - For HTTP: new McpServer per session, but shared services

### Tool Architecture Pattern

Each MCP tool follows a consistent three-file structure in `src/mcp-server/tools/`:

```
toolName/
├── index.ts        # Barrel export for registration function
├── registration.ts # MCP tool schema definition (Zod) + handler registration
└── logic.ts        # Core implementation logic
```

**Pattern Benefits**:
- Clear separation of concerns (schema, registration, logic)
- Easy to add new tools following the same pattern
- Consistent error handling and validation across all tools
- Service dependencies injected via registration function

**Tool Registration Flow**:
1. `registration.ts` defines Zod input schema and tool metadata
2. `registration.ts` registers handler with McpServer instance
3. Handler validates input, calls logic function, returns standardized response
4. `logic.ts` contains pure business logic with service dependencies

### Transport Architecture

Supports dual transport modes with different lifecycle models:

**stdio Transport** (`src/mcp-server/transports/stdioTransport.ts`):
- Single server instance for entire process lifetime
- Direct communication via stdin/stdout
- Used by MCP clients (Claude Desktop, Cline)
- Lower latency, simpler lifecycle

**HTTP Transport** (`src/mcp-server/transports/httpTransport.ts`):
- Per-session server instances via factory pattern
- SSE (Server-Sent Events) for real-time communication
- Authentication strategies (JWT, OAuth 2.1)
- CORS support for web integration
- Session management and cleanup

### Services Architecture

#### ObsidianRestApiService (`src/services/obsidianRestAPI/`)

Typed HTTP client for Obsidian Local REST API plugin with method organization:

- `methods/activeFileMethods.ts` - Active file operations
- `methods/commandMethods.ts` - Command execution (new in v2.0.7)
- `methods/openMethods.ts` - File opening operations
- `methods/patchMethods.ts` - File modification operations
- `methods/periodicNoteMethods.ts` - Daily/weekly/monthly note operations
- `methods/searchMethods.ts` - Search operations
- `methods/vaultMethods.ts` - Vault-wide operations

**Key Features**:
- Zod schema validation for all requests/responses
- Automatic retry logic for transient failures
- Request context propagation for debugging
- SSL verification toggle for self-signed certificates

#### VaultCacheService (`src/services/obsidianRestAPI/vaultCache/`)

In-memory cache for improved performance and resilience:

- Initial build on startup (background, non-blocking)
- Periodic refresh based on file modification times
- Proactive updates after file modifications
- Fallback for `obsidian_global_search` when API fails
- Configurable refresh interval (default: 10 minutes)

**Cache States**:
- `idle` - Not built yet
- `building` - Initial build in progress
- `ready` - Cache available for use
- `refreshing` - Periodic update in progress

## Configuration

### Required Environment Variables

- `OBSIDIAN_API_KEY` - API key from Obsidian Local REST API plugin (**required**)
- `OBSIDIAN_BASE_URL` - Base URL (default: `http://127.0.0.1:27123`)

### Transport Configuration

- `MCP_TRANSPORT_TYPE` - "stdio" or "http" (default: "stdio")
- `MCP_HTTP_PORT` - HTTP server port (default: 3010)
- `MCP_HTTP_HOST` - HTTP server host (default: "127.0.0.1")

### Cache & Performance

- `OBSIDIAN_ENABLE_CACHE` - Enable vault caching (default: "true")
- `OBSIDIAN_CACHE_REFRESH_INTERVAL_MIN` - Cache refresh interval in minutes (default: 10)
- `OBSIDIAN_API_SEARCH_TIMEOUT_MS` - API search timeout (default: 30000)

### Security & Debugging

- `MCP_LOG_LEVEL` - Logging verbosity: debug, info, warning, error (default: "info")
- `OBSIDIAN_VERIFY_SSL` - SSL verification (default: "false" for self-signed certs)
- `MCP_AUTH_MODE` - HTTP auth: "jwt" or "oauth" (HTTP transport only)

**Validation**: All environment variables are validated using Zod schemas in `src/config/index.ts`. Invalid configuration will cause startup failure with detailed error messages.

## MCP Tools Available

The server provides 12 standardized MCP tools:

### Note Operations
- `obsidian_read_note` - Read note content and metadata (markdown or JSON format)
- `obsidian_update_note` - Append, prepend, or overwrite note content
- `obsidian_delete_note` - Permanently delete notes from vault
- `obsidian_list_notes` - List notes in directories with filtering and tree view

### Editor Operations
- `obsidian_get_selection` - Retrieve currently selected text from active Obsidian editor (requires AME3Helper plugin)
- `obsidian_replace_section` - Replace text at specific positions with fail-safe validation (requires AME3Helper plugin)

### Search & Replace
- `obsidian_global_search` - Search across entire vault (text/regex, pagination)
- `obsidian_search_replace` - Find and replace within specific notes

### Metadata Management
- `obsidian_manage_frontmatter` - Get, set, or delete YAML frontmatter keys
- `obsidian_manage_tags` - Add, remove, or list tags (frontmatter and inline)

### Command Execution (New in v2.0.7)
- `obsidian_list_commands` - Discover available Obsidian commands (309+ total)
- `obsidian_execute_command` - Execute specific Obsidian commands by ID

**Targeting Modes**: Many tools support flexible targeting:
- `filePath` - Specific vault-relative path
- `activeFile` - Currently active file in Obsidian
- `periodicNote` - Daily, weekly, monthly, quarterly, yearly notes

## Development Guidelines

### Adding a New MCP Tool

1. Create tool directory: `src/mcp-server/tools/obsidian[ToolName]Tool/`
2. Create three files following the pattern:
   - `index.ts` - Export registration function
   - `registration.ts` - Define Zod schema, register handler
   - `logic.ts` - Implement business logic
3. Import and call registration in `src/mcp-server/server.ts`
4. Update README.md with tool description

**Template Structure**:
```typescript
// registration.ts
export async function registerObsidianToolNameTool(
  server: McpServer,
  obsidianService: ObsidianRestApiService,
  vaultCacheService?: VaultCacheService
) {
  const ToolInputSchema = z.object({
    // Define input schema
  });

  server.tool(
    "obsidian_tool_name",
    {
      description: "Tool description",
      inputSchema: zodToJsonSchema(ToolInputSchema),
    },
    async (args) => {
      // Validate, call logic, return response
    }
  );
}
```

### Error Handling Philosophy

- **Centralized Handler**: `src/utils/internal/errorHandler.ts` processes all errors
- **Request Context**: Every operation has a unique request ID for debugging
- **McpError Types**: Custom error types for standardized MCP responses
- **Graceful Degradation**: Cache fallbacks, retry logic, clear error messages

**Error Propagation Flow**:
1. Error thrown in tool logic
2. Caught in registration handler
3. Passed to ErrorHandler.handleError()
4. Logged with full context
5. Returned to client as standardized error response

### Logging Conventions

- Use `logger.debug()` for detailed internal state
- Use `logger.info()` for significant events (startup, tool execution)
- Use `logger.warning()` for recoverable issues
- Use `logger.error()` for operation failures
- Always include request context for correlation

### Type Safety Best Practices

- Define Zod schemas for all external inputs
- Use `z.infer<>` to derive TypeScript types from schemas
- Validate early, fail fast with clear error messages
- Global type definitions in `src/types-global/`

### Testing with MCP Inspector

```bash
# Start MCP Inspector on stdio transport
npm run inspect:stdio

# Start MCP Inspector on HTTP transport
npm run inspect:http
```

MCP Inspector provides interactive testing of tools, allowing you to:
- List available tools and their schemas
- Execute tools with custom inputs
- View real-time responses and errors
- Test authentication flows (HTTP transport)

## Common Development Tasks

### Debugging Startup Issues

1. Check environment variables are set correctly
2. Verify Obsidian Local REST API plugin is running
3. Test API connectivity: `npm run fetch:spec`
4. Check logs in `logs/` directory
5. Enable debug logging: `MCP_LOG_LEVEL=debug`

### Updating Dependencies

```bash
# Update all dependencies to latest
npm update

# Check for outdated packages
npm outdated

# Update package-lock.json
npm install
```

### Performance Monitoring

- Cache performance: Check `VaultCacheService` logs for build/refresh times
- Tool execution: Request IDs allow tracing individual operations
- API latency: ObsidianRestApiService logs include timing information

## Prerequisites for Development

1. **Node.js** >= 16.0.0 (ESM support required)
2. **Obsidian** with Local REST API plugin installed and configured
3. Valid API key from the plugin
4. TypeScript knowledge for development

## Integration Notes

**Parent Vault**: This plugin is deployed within `/Users/peterbeck/Obsidian/AME3/.obsidian/plugins/`.

**Related Systems**:
- AME3Helper plugin (content publishing)
- AI Assistant plugin (AI integration)
- Parent vault's MCP configuration in Claude Desktop/Code settings

**Performance Considerations**:
- Multiple MCP server instances can cause degradation (see parent CLAUDE.md)
- Always exit Claude Code properly to prevent orphaned processes
- Monitor process count: `ps aux | grep obsidian-mcp-server`