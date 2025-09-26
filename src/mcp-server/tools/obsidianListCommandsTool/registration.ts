import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ObsidianRestApiService } from "../../../services/obsidianRestAPI/index.js";
import { BaseErrorCode, McpError } from "../../../types-global/errors.js";
import {
  ErrorHandler,
  logger,
  RequestContext,
  requestContextService,
} from "../../../utils/index.js";
// Import necessary types and schemas from the logic file
import type {
  ObsidianListCommandsRegistrationInput,
  ObsidianListCommandsResponse,
} from "./logic.js";
import {
  ObsidianListCommandsInputSchema,
  ObsidianListCommandsInputSchemaShape,
  processObsidianListCommands,
} from "./logic.js";

/**
 * Registers the 'obsidian_list_commands' tool with the MCP server.
 *
 * This tool retrieves and filters the list of available Obsidian commands,
 * enabling AI agents to discover what actions can be performed in the vault.
 * It supports filtering by regex patterns, plugin inclusion/exclusion, and
 * specific command categories.
 *
 * The response includes command IDs, display names, categories, and metadata
 * about the filtering results, providing comprehensive information for
 * command discovery and automation workflows.
 *
 * @param {McpServer} server - The MCP server instance to register the tool with.
 * @param {ObsidianRestApiService} obsidianService - An instance of the Obsidian REST API service
 *   used to interact with the user's Obsidian vault.
 * @returns {Promise<void>} A promise that resolves when the tool registration is complete or rejects on error.
 * @throws {McpError} Throws an McpError if registration fails critically.
 */
export const registerObsidianListCommandsTool = async (
  server: McpServer,
  obsidianService: ObsidianRestApiService,
): Promise<void> => {
  const toolName = "obsidian_list_commands";
  const toolDescription =
    "Lists all available Obsidian commands with their IDs and display names. Supports filtering by regex patterns, plugin inclusion/exclusion, and specific command categories. Returns command metadata including categories derived from plugin prefixes, total counts, and filtering statistics. Essential for command discovery and automation workflows.";

  // Create a context specifically for the registration process.
  const registrationContext: RequestContext =
    requestContextService.createRequestContext({
      operation: "RegisterObsidianListCommandsTool",
      toolName: toolName,
      module: "ObsidianListCommandsRegistration", // Identify the module
    });

  logger.info(`Attempting to register tool: ${toolName}`, registrationContext);

  // Wrap the registration logic in a tryCatch block for robust error handling during server setup.
  await ErrorHandler.tryCatch(
    async () => {
      // Use the high-level SDK method `server.tool` for registration.
      // It handles schema generation from the shape, basic validation, and routing.
      server.tool(
        toolName,
        toolDescription,
        ObsidianListCommandsInputSchemaShape, // Provide the base Zod schema shape for input definition.
        /**
         * The handler function executed when the 'obsidian_list_commands' tool is called by the client.
         *
         * @param {ObsidianListCommandsRegistrationInput} params - The raw input parameters received from the client,
         *   matching the structure defined by ObsidianListCommandsInputSchemaShape.
         * @returns {Promise<CallToolResult>} A promise resolving to the structured result for the MCP client,
         *   containing either the successful response data (serialized JSON) or an error indication.
         */
        async (params: ObsidianListCommandsRegistrationInput) => {
          // Create a specific context for this handler invocation, linked to the registration context.
          const handlerContext: RequestContext =
            requestContextService.createRequestContext({
              parentContext: registrationContext,
              operation: "HandleObsidianListCommandsRequest",
              toolName: toolName,
              params: {
                // Log key parameters for debugging
                filterPattern: params.filterPattern,
                includePlugins: params.includePlugins,
                category: params.category,
              },
            });
          logger.debug(`Handling '${toolName}' request`, handlerContext);

          // Wrap the core logic execution in a tryCatch block for handling errors during processing.
          return await ErrorHandler.tryCatch(
            async () => {
              // **Crucial Step:** Explicitly parse and validate the raw input parameters using the
              // *refined* Zod schema (`ObsidianListCommandsInputSchema`). This applies stricter rules
              // and cross-field validations defined in logic.ts.
              const validatedParams =
                ObsidianListCommandsInputSchema.parse(params);
              logger.debug(
                `Input parameters successfully validated against refined schema.`,
                handlerContext,
              );

              // Delegate the actual command listing logic to the dedicated processing function.
              // Pass the *validated* parameters, the handler context, and the Obsidian service instance.
              const response: ObsidianListCommandsResponse =
                await processObsidianListCommands(
                  validatedParams,
                  handlerContext,
                  obsidianService,
                );
              logger.debug(
                `'${toolName}' processed successfully`,
                handlerContext,
              );

              // Format the successful response object from the logic function into the required MCP CallToolResult structure.
              // The entire response object (containing success, commands, counts, etc.) is serialized to JSON.
              return {
                content: [
                  {
                    type: "text", // Standard content type for structured JSON data
                    text: JSON.stringify(response, null, 2), // Pretty-print JSON for readability
                  },
                ],
                isError: false, // Indicate successful execution to the client
              };
            },
            {
              // Configuration for the inner error handler (processing logic).
              operation: `processing ${toolName} handler`,
              context: handlerContext,
              input: params, // Log the full raw input parameters if an error occurs during processing.
              // Custom error mapping to ensure consistent McpError format is returned to the client.
              errorMapper: (error: unknown) =>
                new McpError(
                  // Use the specific code from McpError if available, otherwise default to INTERNAL_ERROR.
                  error instanceof McpError
                    ? error.code
                    : BaseErrorCode.INTERNAL_ERROR,
                  `Error processing ${toolName} tool: ${error instanceof Error ? error.message : "Unknown error"}`,
                  { ...handlerContext }, // Include context in the error details
                ),
            },
          ); // End of inner ErrorHandler.tryCatch
        },
      ); // End of server.tool call

      logger.info(
        `Tool registered successfully: ${toolName}`,
        registrationContext,
      );
    },
    {
      // Configuration for the outer error handler (registration process).
      operation: `registering tool ${toolName}`,
      context: registrationContext,
      errorCode: BaseErrorCode.INTERNAL_ERROR, // Default error code for registration failure.
      // Custom error mapping for registration failures.
      errorMapper: (error: unknown) =>
        new McpError(
          error instanceof McpError ? error.code : BaseErrorCode.INTERNAL_ERROR,
          `Failed to register tool '${toolName}': ${error instanceof Error ? error.message : "Unknown error"}`,
          { ...registrationContext }, // Include context
        ),
      critical: true, // Treat registration failure as critical, potentially halting server startup.
    },
  ); // End of outer ErrorHandler.tryCatch
};