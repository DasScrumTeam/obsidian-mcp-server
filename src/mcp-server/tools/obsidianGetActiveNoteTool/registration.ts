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
  ObsidianGetActiveNoteInput,
  ObsidianGetActiveNoteResponse,
} from "./logic.js";
import {
  ObsidianGetActiveNoteInputSchema,
  ObsidianGetActiveNoteInputSchemaShape,
  processObsidianGetActiveNote,
} from "./logic.js";

/**
 * Registers the 'obsidian_get_active_note' tool with the MCP server.
 *
 * This tool retrieves the vault-relative path of the currently active markdown file
 * in Obsidian. It requires the AME3Helper plugin's REST API extension to be active.
 *
 * @param server - The MCP server instance to register the tool with.
 * @param obsidianService - An instance of the Obsidian REST API service.
 * @returns A promise that resolves when the tool registration is complete.
 * @throws McpError if registration fails.
 */
export const registerObsidianGetActiveNoteTool = async (
  server: McpServer,
  obsidianService: ObsidianRestApiService,
): Promise<void> => {
  const toolName = "obsidian_get_active_note";
  const toolDescription =
    "Retrieves the vault-relative path of the currently active markdown file in Obsidian. Returns an object containing the file path ('file': string | null). Returns null if no markdown file is currently active. Requires no input parameters. Note: This tool requires the AME3Helper plugin with REST API extension to be active.";

  const registrationContext: RequestContext =
    requestContextService.createRequestContext({
      operation: "RegisterObsidianGetActiveNoteTool",
      toolName: toolName,
      module: "ObsidianGetActiveNoteRegistration",
    });

  logger.info(`Attempting to register tool: ${toolName}`, registrationContext);

  await ErrorHandler.tryCatch(
    async () => {
      server.tool(
        toolName,
        toolDescription,
        ObsidianGetActiveNoteInputSchemaShape,
        async (params: ObsidianGetActiveNoteInput) => {
          const handlerContext: RequestContext =
            requestContextService.createRequestContext({
              parentContext: registrationContext,
              operation: "HandleObsidianGetActiveNoteRequest",
              toolName: toolName,
              params: {},
            });
          logger.debug(`Handling '${toolName}' request`, handlerContext);

          return await ErrorHandler.tryCatch(
            async () => {
              const validatedParams =
                ObsidianGetActiveNoteInputSchema.parse(params);

              const response: ObsidianGetActiveNoteResponse =
                await processObsidianGetActiveNote(
                  validatedParams,
                  handlerContext,
                  obsidianService,
                );
              logger.debug(
                `'${toolName}' processed successfully. File: ${response.file || "N/A"}`,
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
