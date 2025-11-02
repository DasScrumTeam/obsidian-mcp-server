import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ObsidianRestApiService } from "../../../services/obsidianRestAPI/index.js";
import { BaseErrorCode, McpError } from "../../../types-global/errors.js";
import {
  ErrorHandler,
  logger,
  RequestContext,
  requestContextService,
} from "../../../utils/index.js";
// Import necessary types, schema, and logic function from the logic file
import type {
  ObsidianReplaceSectionInput,
  ObsidianReplaceSectionResponse,
} from "./logic.js";
import {
  ObsidianReplaceSectionInputSchema,
  ObsidianReplaceSectionInputSchemaShape,
  processObsidianReplaceSection,
} from "./logic.js";

/**
 * Registers the 'obsidian_replace_section' tool with the MCP server.
 *
 * This tool replaces text at specific positions in the active Obsidian editor
 * with comprehensive fail-safe validation:
 * - Active editor exists
 * - File path matches expected
 * - Positions are within bounds
 * - Content at positions matches expectedText
 *
 * This tool requires the AME3Helper plugin's REST API extension to be registered,
 * which provides the /active/replace-range/ endpoint.
 *
 * @param {McpServer} server - The MCP server instance to register the tool with.
 * @param {ObsidianRestApiService} obsidianService - An instance of the Obsidian REST API service
 *   used to interact with the user's Obsidian vault.
 * @returns {Promise<void>} A promise that resolves when the tool registration is complete or rejects on error.
 * @throws {McpError} Throws an McpError if registration fails critically.
 */
export const registerObsidianReplaceSectionTool = async (
  server: McpServer,
  obsidianService: ObsidianRestApiService,
): Promise<void> => {
  const toolName = "obsidian_replace_section";
  const toolDescription =
    "Replace text at specific positions in the active Obsidian editor with fail-safe validation. Requires file path, new text, position coordinates (0-indexed), and expected text for validation. Performs 4-layer safety validation: (1) active editor exists, (2) file path matches, (3) positions within bounds, (4) content matches expectedText. Returns success status, file path, replaced text, new text, and final positions. Position coordinates are 0-indexed (line 0, ch 0 is the first character). This operation is atomic and includes undo history tracking. Note: This tool requires the AME3Helper plugin with REST API extension to be active.";

  // Create a context specifically for the registration process.
  const registrationContext: RequestContext =
    requestContextService.createRequestContext({
      operation: "RegisterObsidianReplaceSectionTool",
      toolName: toolName,
      module: "ObsidianReplaceSectionRegistration",
    });

  logger.info(`Attempting to register tool: ${toolName}`, registrationContext);

  // Wrap the registration logic in a tryCatch block for robust error handling during server setup.
  await ErrorHandler.tryCatch(
    async () => {
      // Use the high-level SDK method `server.tool` for registration.
      server.tool(
        toolName,
        toolDescription,
        ObsidianReplaceSectionInputSchemaShape, // Provide the Zod schema shape for input definition.
        /**
         * The handler function executed when the 'obsidian_replace_section' tool is called by the client.
         *
         * @param {ObsidianReplaceSectionInput} params - The input parameters
         * @returns {Promise<CallToolResult>} A promise resolving to the structured result for the MCP client.
         */
        async (params: ObsidianReplaceSectionInput) => {
          // Create a specific context for this handler invocation.
          const handlerContext: RequestContext =
            requestContextService.createRequestContext({
              parentContext: registrationContext,
              operation: "HandleObsidianReplaceSectionRequest",
              toolName: toolName,
              params: {
                file: params.file,
                expectedTextLength: params.expectedText?.length || 0,
                newTextLength: params.newText?.length || 0,
                positions: params.positions,
              },
            });
          logger.debug(`Handling '${toolName}' request`, handlerContext);

          // Wrap the core logic execution in a tryCatch block.
          return await ErrorHandler.tryCatch(
            async () => {
              // Validate the input parameters
              const validatedParams =
                ObsidianReplaceSectionInputSchema.parse(params);

              // Delegate the actual replacement logic to the dedicated processing function.
              const response: ObsidianReplaceSectionResponse =
                await processObsidianReplaceSection(
                  validatedParams,
                  handlerContext,
                  obsidianService,
                );
              logger.debug(
                `'${toolName}' processed successfully. Replaced ${response.replacedText.length} chars with ${response.newText.length} chars`,
                handlerContext,
              );

              // Format the successful response object into the required MCP CallToolResult structure.
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(response, null, 2), // Pretty-print JSON
                  },
                ],
                isError: false,
              };
            },
            {
              // Configuration for the inner error handler (processing logic).
              operation: `processing ${toolName} handler`,
              context: handlerContext,
              input: params,
              // Custom error mapping for consistent error reporting.
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
      // Configuration for the outer error handler (registration process).
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
