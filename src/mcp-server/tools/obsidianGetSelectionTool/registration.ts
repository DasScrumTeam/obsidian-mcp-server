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
  ObsidianGetSelectionInput,
  ObsidianGetSelectionResponse,
} from "./logic.js";
import {
  ObsidianGetSelectionInputSchema,
  ObsidianGetSelectionInputSchemaShape,
  processObsidianGetSelection,
} from "./logic.js";

/**
 * Registers the 'obsidian_get_selection' tool with the MCP server.
 *
 * This tool retrieves the currently selected text from the active Obsidian editor.
 * It operates on the currently active markdown view and returns information about
 * whether text is selected, the selected text content, and the path to the active file.
 *
 * This tool requires the AME3Helper plugin's REST API extension to be registered,
 * which provides the /active/selection/ endpoint.
 *
 * @param {McpServer} server - The MCP server instance to register the tool with.
 * @param {ObsidianRestApiService} obsidianService - An instance of the Obsidian REST API service
 *   used to interact with the user's Obsidian vault.
 * @returns {Promise<void>} A promise that resolves when the tool registration is complete or rejects on error.
 * @throws {McpError} Throws an McpError if registration fails critically.
 */
export const registerObsidianGetSelectionTool = async (
  server: McpServer,
  obsidianService: ObsidianRestApiService,
): Promise<void> => {
  const toolName = "obsidian_get_selection";
  const toolDescription =
    "Retrieves the currently selected text from the active Obsidian editor. Returns an object containing whether text is selected ('selected': boolean), the selected text content ('text': string, empty if no selection), and the path to the active file ('file': string | null). Requires no input parameters. Note: This tool requires the AME3Helper plugin with REST API extension to be active.";

  // Create a context specifically for the registration process.
  const registrationContext: RequestContext =
    requestContextService.createRequestContext({
      operation: "RegisterObsidianGetSelectionTool",
      toolName: toolName,
      module: "ObsidianGetSelectionRegistration",
    });

  logger.info(`Attempting to register tool: ${toolName}`, registrationContext);

  // Wrap the registration logic in a tryCatch block for robust error handling during server setup.
  await ErrorHandler.tryCatch(
    async () => {
      // Use the high-level SDK method `server.tool` for registration.
      server.tool(
        toolName,
        toolDescription,
        ObsidianGetSelectionInputSchemaShape, // Provide the Zod schema shape for input definition.
        /**
         * The handler function executed when the 'obsidian_get_selection' tool is called by the client.
         *
         * @param {ObsidianGetSelectionInput} params - The input parameters (empty object in this case).
         * @returns {Promise<CallToolResult>} A promise resolving to the structured result for the MCP client.
         */
        async (params: ObsidianGetSelectionInput) => {
          // Create a specific context for this handler invocation.
          const handlerContext: RequestContext =
            requestContextService.createRequestContext({
              parentContext: registrationContext,
              operation: "HandleObsidianGetSelectionRequest",
              toolName: toolName,
              params: {}, // No parameters for this tool
            });
          logger.debug(`Handling '${toolName}' request`, handlerContext);

          // Wrap the core logic execution in a tryCatch block.
          return await ErrorHandler.tryCatch(
            async () => {
              // Validate the input parameters (even though it's an empty object)
              const validatedParams =
                ObsidianGetSelectionInputSchema.parse(params);

              // Delegate the actual selection retrieval logic to the dedicated processing function.
              const response: ObsidianGetSelectionResponse =
                await processObsidianGetSelection(
                  validatedParams,
                  handlerContext,
                  obsidianService,
                );
              logger.debug(
                `'${toolName}' processed successfully. Selected: ${response.selected}`,
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
