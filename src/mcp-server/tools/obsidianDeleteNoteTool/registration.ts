import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ObsidianRestApiService,
  VaultCacheService,
} from "../../../services/obsidianRestAPI/index.js";
import { BaseErrorCode, McpError } from "../../../types-global/errors.js";
import {
  ErrorHandler,
  logger,
  RequestContext,
  requestContextService,
} from "../../../utils/index.js";
// Import necessary types, schema, and logic function from the logic file
import type {
  ObsidianDeleteNoteInput,
  ObsidianDeleteNoteResponse,
} from "./logic.js";
import {
  ObsidianDeleteNoteInputSchema,
  ObsidianDeleteNoteInputSchemaShape,
  processObsidianDeleteNote,
} from "./logic.js";

/**
 * Registers the 'obsidian_delete_note' tool with the MCP server.
 *
 * This tool permanently deletes a file from the user's Obsidian vault.
 * It supports targeting by specific file path or currently active file.
 * For filePath targeting: requires the vault-relative path, including the file extension,
 * attempts a case-sensitive deletion first, followed by a case-insensitive
 * fallback search and delete if the initial attempt fails with a 'NOT_FOUND' error.
 *
 * The response is a JSON string containing a success status and a confirmation message.
 *
 * @param {McpServer} server - The MCP server instance to register the tool with.
 * @param {ObsidianRestApiService} obsidianService - An instance of the Obsidian REST API service
 *   used to interact with the user's Obsidian vault.
 * @returns {Promise<void>} A promise that resolves when the tool registration is complete or rejects on error.
 * @throws {McpError} Throws an McpError if registration fails critically.
 */
export const registerObsidianDeleteNoteTool = async (
  server: McpServer,
  obsidianService: ObsidianRestApiService,
  vaultCacheService: VaultCacheService | undefined,
): Promise<void> => {
  const toolName = "obsidian_delete_note";
  // Updated description to reflect active file support
  const toolDescription =
    "Permanently deletes a file from the Obsidian vault. Supports targeting by file path (with case-insensitive fallback) or currently active file. For filePath targeting, requires the vault-relative path including the file extension. Returns a success message.";

  // Create a context specifically for the registration process.
  const registrationContext: RequestContext =
    requestContextService.createRequestContext({
      operation: "RegisterObsidianDeleteNoteTool",
      toolName: toolName,
      module: "ObsidianDeleteNoteRegistration", // Identify the module
    });

  logger.info(`Attempting to register tool: ${toolName}`, registrationContext);

  // Wrap the registration logic in a tryCatch block for robust error handling during server setup.
  await ErrorHandler.tryCatch(
    async () => {
      // Use the high-level SDK method `server.tool` for registration.
      server.tool(
        toolName,
        toolDescription,
        ObsidianDeleteNoteInputSchemaShape, // Provide the Zod schema shape for input definition.
        /**
         * The handler function executed when the 'obsidian_delete_note' tool is called by the client.
         *
         * @param {ObsidianDeleteNoteInput} params - The input parameters received from the client,
         *   validated against the ObsidianDeleteNoteInputSchema shape.
         * @returns {Promise<CallToolResult>} A promise resolving to the structured result for the MCP client,
         *   containing either the successful response data (serialized JSON) or an error indication.
         */
        async (params: ObsidianDeleteNoteInput) => {
          // Type matches the inferred input schema
          // Create a specific context for this handler invocation.
          const handlerContext: RequestContext =
            requestContextService.createRequestContext({
              parentContext: registrationContext, // Link to registration context
              operation: "HandleObsidianDeleteNoteRequest",
              toolName: toolName,
              params: {
                filePath: params.filePath,
                targetType: params.targetType,
              }, // Log the targeting parameters
            });
          logger.debug(`Handling '${toolName}' request`, handlerContext);

          // Wrap the core logic execution in a tryCatch block.
          return await ErrorHandler.tryCatch(
            async () => {
              // Validate the input parameters using the full refined schema
              const validatedParams = ObsidianDeleteNoteInputSchema.parse(params);

              // Delegate the actual file deletion logic to the processing function.
              const response: ObsidianDeleteNoteResponse =
                await processObsidianDeleteNote(
                  validatedParams,
                  handlerContext,
                  obsidianService,
                  vaultCacheService,
                );
              logger.debug(
                `'${toolName}' processed successfully`,
                handlerContext,
              );

              // Format the successful response object from the logic function into the required MCP CallToolResult structure.
              // The response object (success, message) is serialized to JSON.
              return {
                content: [
                  {
                    type: "text", // Standard content type for structured JSON data
                    text: JSON.stringify(response, null, 2), // Pretty-print JSON
                  },
                ],
                isError: false, // Indicate successful execution
              };
            },
            {
              // Configuration for the inner error handler (processing logic).
              operation: `processing ${toolName} handler`,
              context: handlerContext,
              input: params, // Log the full input parameters if an error occurs.
              // Custom error mapping for consistent error reporting.
              errorMapper: (error: unknown) =>
                new McpError(
                  error instanceof McpError
                    ? error.code
                    : BaseErrorCode.INTERNAL_ERROR,
                  `Error processing ${toolName} tool: ${error instanceof Error ? error.message : "Unknown error"}`,
                  { ...handlerContext }, // Include context
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
      critical: true, // Treat registration failure as critical.
    },
  ); // End of outer ErrorHandler.tryCatch
};
