import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ObsidianRestApiService } from "../../../services/obsidianRestAPI/index.js";
import { BaseErrorCode, McpError } from "../../../types-global/errors.js";
import {
  ErrorHandler,
  logger,
  RequestContext,
  requestContextService,
} from "../../../utils/index.js";
import type {
  ObsidianDisconnectSessionInput,
  ObsidianDisconnectSessionResponse,
} from "./logic.js";
import {
  ObsidianDisconnectSessionInputSchema,
  ObsidianDisconnectSessionInputSchemaShape,
  processObsidianDisconnectSession,
} from "./logic.js";

/**
 * Registers the 'obsidian_disconnect_session' tool with the MCP server.
 *
 * This tool disconnects a Claude session from an Obsidian note by atomically
 * removing the 'ai-claude-session' frontmatter field. It requires the AME3Helper
 * plugin's REST API extension to be active.
 *
 * @param server - The MCP server instance to register the tool with.
 * @param obsidianService - An instance of the Obsidian REST API service.
 * @returns A promise that resolves when the tool registration is complete.
 * @throws McpError if registration fails.
 */
export const registerObsidianDisconnectSessionTool = async (
  server: McpServer,
  obsidianService: ObsidianRestApiService,
): Promise<void> => {
  const toolName = "obsidian_disconnect_session";
  const toolDescription =
    "Disconnects a Claude session from an Obsidian note by removing the 'ai-claude-session' frontmatter field. Accepts an optional 'filePath' parameter (vault-relative path); if omitted, operates on the currently active note. Returns the disconnected file path and success status. Requires the AME3Helper plugin with REST API extension to be active.";

  const registrationContext: RequestContext =
    requestContextService.createRequestContext({
      operation: "RegisterObsidianDisconnectSessionTool",
      toolName: toolName,
      module: "ObsidianDisconnectSessionRegistration",
    });

  logger.info(`Attempting to register tool: ${toolName}`, registrationContext);

  await ErrorHandler.tryCatch(
    async () => {
      server.tool(
        toolName,
        toolDescription,
        ObsidianDisconnectSessionInputSchemaShape,
        async (params: ObsidianDisconnectSessionInput) => {
          const handlerContext: RequestContext =
            requestContextService.createRequestContext({
              parentContext: registrationContext,
              operation: "HandleObsidianDisconnectSessionRequest",
              toolName: toolName,
              params: { filePath: params.filePath || "(active note)" },
            });
          logger.debug(`Handling '${toolName}' request`, handlerContext);

          return await ErrorHandler.tryCatch(
            async () => {
              const validatedParams =
                ObsidianDisconnectSessionInputSchema.parse(params);

              const response: ObsidianDisconnectSessionResponse =
                await processObsidianDisconnectSession(
                  validatedParams,
                  handlerContext,
                  obsidianService,
                );
              logger.debug(
                `'${toolName}' processed successfully. File: ${response.file}`,
                handlerContext,
              );

              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(response, null, 2),
                  },
                ],
                isError: false,
              };
            },
            {
              operation: `processing ${toolName} handler`,
              context: handlerContext,
              input: params,
              errorMapper: (error: unknown) =>
                new McpError(
                  error instanceof McpError
                    ? error.code
                    : BaseErrorCode.INTERNAL_ERROR,
                  `Error processing ${toolName} tool: ${error instanceof Error ? error.message : "Unknown error"}`,
                  { ...handlerContext },
                ),
            },
          );
        },
      );

      logger.info(
        `Tool registered successfully: ${toolName}`,
        registrationContext,
      );
    },
    {
      operation: `registering tool ${toolName}`,
      context: registrationContext,
      errorCode: BaseErrorCode.INTERNAL_ERROR,
      errorMapper: (error: unknown) =>
        new McpError(
          error instanceof McpError ? error.code : BaseErrorCode.INTERNAL_ERROR,
          `Failed to register tool '${toolName}': ${error instanceof Error ? error.message : "Unknown error"}`,
          { ...registrationContext },
        ),
      critical: true,
    },
  );
};
