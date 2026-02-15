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
  ObsidianConnectSessionInput,
  ObsidianConnectSessionResponse,
} from "./logic.js";
import {
  ObsidianConnectSessionInputSchema,
  ObsidianConnectSessionInputSchemaShape,
  processObsidianConnectSession,
} from "./logic.js";

/**
 * Registers the 'obsidian_connect_session' tool with the MCP server.
 *
 * This tool connects a Claude session to the currently active Obsidian note by
 * atomically writing the 'ai-claude-session' frontmatter field. It requires the
 * AME3Helper plugin's REST API extension to be active.
 *
 * @param server - The MCP server instance to register the tool with.
 * @param obsidianService - An instance of the Obsidian REST API service.
 * @returns A promise that resolves when the tool registration is complete.
 * @throws McpError if registration fails.
 */
export const registerObsidianConnectSessionTool = async (
  server: McpServer,
  obsidianService: ObsidianRestApiService,
): Promise<void> => {
  const toolName = "obsidian_connect_session";
  const toolDescription =
    "Connects a Claude session to the currently active Obsidian note. Atomically writes 'ai-claude-session' frontmatter field. Returns connected file path and session ID. Requires the AME3Helper plugin with REST API extension to be active.";

  const registrationContext: RequestContext =
    requestContextService.createRequestContext({
      operation: "RegisterObsidianConnectSessionTool",
      toolName: toolName,
      module: "ObsidianConnectSessionRegistration",
    });

  logger.info(`Attempting to register tool: ${toolName}`, registrationContext);

  await ErrorHandler.tryCatch(
    async () => {
      server.tool(
        toolName,
        toolDescription,
        ObsidianConnectSessionInputSchemaShape,
        async (params: ObsidianConnectSessionInput) => {
          const handlerContext: RequestContext =
            requestContextService.createRequestContext({
              parentContext: registrationContext,
              operation: "HandleObsidianConnectSessionRequest",
              toolName: toolName,
              params: { sessionId: params.sessionId },
            });
          logger.debug(`Handling '${toolName}' request`, handlerContext);

          return await ErrorHandler.tryCatch(
            async () => {
              const validatedParams =
                ObsidianConnectSessionInputSchema.parse(params);

              const response: ObsidianConnectSessionResponse =
                await processObsidianConnectSession(
                  validatedParams,
                  handlerContext,
                  obsidianService,
                );
              logger.debug(
                `'${toolName}' processed successfully. File: ${response.file}, Session: ${response.sessionId}`,
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
