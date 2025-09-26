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
  ObsidianExecuteCommandRegistrationInput,
  ObsidianExecuteCommandResponse,
} from "./logic.js";
import {
  ObsidianExecuteCommandInputSchema,
  ObsidianExecuteCommandInputSchemaShape,
  processObsidianExecuteCommand,
} from "./logic.js";

/**
 * Registers the 'obsidian_execute_command' tool with the MCP server.
 *
 * This tool executes a specific Obsidian command by its ID, enabling AI agents
 * to trigger actions like copying content as HTML, publishing to Hugo, exporting
 * to PDF, and other Obsidian functionality. It supports timeout controls and
 * provides detailed execution feedback.
 *
 * The response includes execution status, timing information, error details,
 * and resolved command names for comprehensive automation workflows.
 *
 * @param {McpServer} server - The MCP server instance to register the tool with.
 * @param {ObsidianRestApiService} obsidianService - An instance of the Obsidian REST API service
 *   used to interact with the user's Obsidian vault.
 * @returns {Promise<void>} A promise that resolves when the tool registration is complete or rejects on error.
 * @throws {McpError} Throws an McpError if registration fails critically.
 */
export const registerObsidianExecuteCommandTool = async (
  server: McpServer,
  obsidianService: ObsidianRestApiService,
): Promise<void> => {
  const toolName = "obsidian_execute_command";
  const toolDescription =
    "Executes a specific Obsidian command by its exact command ID. Supports commands like copying as HTML, publishing to Hugo, exporting to PDF, and other Obsidian actions. Includes timeout controls, execution timing, and comprehensive error handling. Returns detailed execution feedback including success status, timing metrics, and error details for automation workflows.";

  // Create a context specifically for the registration process.
  const registrationContext: RequestContext =
    requestContextService.createRequestContext({
      operation: "RegisterObsidianExecuteCommandTool",
      toolName: toolName,
      module: "ObsidianExecuteCommandRegistration", // Identify the module
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
        ObsidianExecuteCommandInputSchemaShape, // Provide the base Zod schema shape for input definition.
        /**
         * The handler function executed when the 'obsidian_execute_command' tool is called by the client.
         *
         * @param {ObsidianExecuteCommandRegistrationInput} params - The raw input parameters received from the client,
         *   matching the structure defined by ObsidianExecuteCommandInputSchemaShape.
         * @returns {Promise<CallToolResult>} A promise resolving to the structured result for the MCP client,
         *   containing either the successful response data (serialized JSON) or an error indication.
         */
        async (params: ObsidianExecuteCommandRegistrationInput) => {
          // Create a specific context for this handler invocation, linked to the registration context.
          const handlerContext: RequestContext =
            requestContextService.createRequestContext({
              parentContext: registrationContext,
              operation: "HandleObsidianExecuteCommandRequest",
              toolName: toolName,
              params: {
                // Log key parameters for debugging (be careful with sensitive data)
                commandId: params.commandId,
                timeout: params.timeout,
                waitForCompletion: params.waitForCompletion,
              },
            });
          logger.debug(`Handling '${toolName}' request`, handlerContext);

          // Wrap the core logic execution in a tryCatch block for handling errors during processing.
          return await ErrorHandler.tryCatch(
            async () => {
              // **Crucial Step:** Explicitly parse and validate the raw input parameters using the
              // *refined* Zod schema (`ObsidianExecuteCommandInputSchema`). This applies stricter rules
              // and cross-field validations defined in logic.ts.
              const validatedParams =
                ObsidianExecuteCommandInputSchema.parse(params);
              logger.debug(
                `Input parameters successfully validated against refined schema.`,
                handlerContext,
              );

              // Delegate the actual command execution logic to the dedicated processing function.
              // Pass the *validated* parameters, the handler context, and the Obsidian service instance.
              const response: ObsidianExecuteCommandResponse =
                await processObsidianExecuteCommand(
                  validatedParams,
                  handlerContext,
                  obsidianService,
                );
              logger.debug(
                `'${toolName}' processed successfully`,
                handlerContext,
              );

              // Format the successful response object from the logic function into the required MCP CallToolResult structure.
              // The entire response object (containing success, timing, error details, etc.) is serialized to JSON.
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