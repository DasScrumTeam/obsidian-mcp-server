import { z } from "zod";
import {
  ObsidianCommand,
  ObsidianRestApiService,
} from "../../../services/obsidianRestAPI/index.js";
import { BaseErrorCode, McpError } from "../../../types-global/errors.js";
import {
  logger,
  RequestContext,
  retryWithDelay,
} from "../../../utils/index.js";

// ====================================================================================
// Schema Definitions for Input Validation
// ====================================================================================

/**
 * Zod schema for validating the input parameters of the 'obsidian_list_commands' tool.
 */
export const ObsidianListCommandsInputSchema = z
  .object({
    /**
     * Optional regex pattern to filter command names or IDs.
     * Applied to both command ID and display name fields.
     */
    filterPattern: z
      .string()
      .optional()
      .describe(
        'Optional regex pattern to filter commands by name or ID (e.g., "copy.*html" for HTML copy commands).',
      ),
    /**
     * Whether to include plugin commands in the results.
     * Defaults to true. When false, only shows core Obsidian commands.
     */
    includePlugins: z
      .boolean()
      .default(true)
      .describe(
        "Include commands from plugins in the results. Defaults to true.",
      ),
    /**
     * Optional category filter to show commands from specific plugins.
     * Derived from the command ID prefix (e.g., "copy-as-html", "ame3-helper").
     */
    category: z
      .string()
      .optional()
      .describe(
        'Filter by command category/plugin prefix (e.g., "ame3-helper", "copy-as-html").',
      ),
  })
  .describe("Parameters for listing available Obsidian commands");

/**
 * TypeScript type derived from the input schema for use in function signatures.
 */
export type ObsidianListCommandsInput = z.infer<
  typeof ObsidianListCommandsInputSchema
>;

// ====================================================================================
// Output Response Schema and Types
// ====================================================================================

/**
 * Schema for individual command objects in the response.
 */
export const CommandItemSchema = z.object({
  id: z.string().describe("The unique command identifier"),
  name: z.string().describe("The display name of the command"),
  category: z
    .string()
    .optional()
    .describe("The plugin/category prefix derived from command ID"),
});

/**
 * Zod schema for the response structure of the 'obsidian_list_commands' tool.
 */
export const ObsidianListCommandsResponseSchema = z.object({
  success: z.boolean().describe("Whether the operation completed successfully"),
  commands: z
    .array(CommandItemSchema)
    .describe("Array of available commands matching the criteria"),
  totalCount: z
    .number()
    .describe("Total number of commands available in Obsidian"),
  filteredCount: z
    .number()
    .optional()
    .describe("Number of commands after applying filters"),
  timestamp: z.string().describe("ISO timestamp of when the list was retrieved"),
  message: z.string().describe("Summary message about the operation"),
});

/**
 * TypeScript type for the tool's response structure.
 */
export type ObsidianListCommandsResponse = z.infer<
  typeof ObsidianListCommandsResponseSchema
>;

// ====================================================================================
// Input Schema Shape for MCP Registration
// ====================================================================================

/**
 * The base shape of the input schema, used for MCP tool registration.
 * This is passed to the MCP server's tool registration method.
 */
export const ObsidianListCommandsInputSchemaShape =
  ObsidianListCommandsInputSchema.shape;

/**
 * Type for the raw input parameters received during tool registration.
 */
export type ObsidianListCommandsRegistrationInput = {
  [K in keyof ObsidianListCommandsInput]: ObsidianListCommandsInput[K];
};

// ====================================================================================
// Core Processing Logic
// ====================================================================================

/**
 * Extracts the category/plugin prefix from a command ID.
 * @param commandId - The command ID (e.g., "copy-as-html:copy-as-html-command")
 * @returns The category prefix or "core" for commands without a prefix
 */
function extractCategory(commandId: string): string {
  const colonIndex = commandId.indexOf(":");
  if (colonIndex === -1) {
    // Core Obsidian commands typically don't have a colon
    return "core";
  }
  return commandId.substring(0, colonIndex);
}

/**
 * Applies filters to the command list based on the input parameters.
 * @param commands - Array of raw commands from Obsidian
 * @param params - Validated input parameters
 * @returns Filtered array of commands with category information
 */
function filterCommands(
  commands: ObsidianCommand[],
  params: ObsidianListCommandsInput,
): Array<{ id: string; name: string; category: string }> {
  let filtered = commands.map((cmd) => ({
    id: cmd.id,
    name: cmd.name,
    category: extractCategory(cmd.id),
  }));

  // Apply category filter
  if (params.category) {
    filtered = filtered.filter((cmd) =>
      cmd.category.toLowerCase().includes(params.category!.toLowerCase()),
    );
  }

  // Apply plugin inclusion filter
  if (!params.includePlugins) {
    filtered = filtered.filter((cmd) => cmd.category === "core");
  }

  // Apply pattern filter to both ID and name
  if (params.filterPattern) {
    try {
      const regex = new RegExp(params.filterPattern, "i"); // Case-insensitive
      filtered = filtered.filter(
        (cmd) => regex.test(cmd.id) || regex.test(cmd.name),
      );
    } catch (error) {
      throw new McpError(
        BaseErrorCode.VALIDATION_ERROR,
        `Invalid regex pattern: ${params.filterPattern}`,
      );
    }
  }

  return filtered;
}

/**
 * Main processing function for the 'obsidian_list_commands' tool.
 * Retrieves and filters the list of available Obsidian commands.
 *
 * @param params - Validated input parameters from the client request.
 * @param context - Request context for logging and correlation.
 * @param obsidianService - Service instance for interacting with the Obsidian REST API.
 * @returns Promise resolving to a structured response with the command list.
 * @throws {McpError} If command retrieval fails or parameters are invalid.
 */
export async function processObsidianListCommands(
  params: ObsidianListCommandsInput,
  context: RequestContext,
  obsidianService: ObsidianRestApiService,
): Promise<ObsidianListCommandsResponse> {
  logger.info("Processing obsidian_list_commands request", {
    ...context,
    filterPattern: params.filterPattern,
    includePlugins: params.includePlugins,
    category: params.category,
  });

  try {
    // Retrieve all available commands from Obsidian with retry logic
    const commands = await retryWithDelay(
      async () => {
        return await obsidianService.listCommands(context);
      },
      {
        operationName: "listObsidianCommands",
        context,
        maxRetries: 3,
        delayMs: 1000,
      },
    );

    logger.debug(`Retrieved ${commands.length} commands from Obsidian`, context);

    // Apply filters to the command list
    const filteredCommands = filterCommands(commands, params);

    // Build the response
    const response: ObsidianListCommandsResponse = {
      success: true,
      commands: filteredCommands,
      totalCount: commands.length,
      filteredCount: filteredCommands.length !== commands.length ? filteredCommands.length : undefined,
      timestamp: new Date().toISOString(),
      message: `Retrieved ${filteredCommands.length} commands${
        params.filterPattern || params.category ? " (filtered)" : ""
      }`,
    };

    logger.info("Successfully processed obsidian_list_commands", {
      ...context,
      totalCommands: commands.length,
      filteredCommands: filteredCommands.length,
    });

    return response;
  } catch (error) {
    logger.error("Error processing obsidian_list_commands", {
      ...context,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Re-throw as McpError with appropriate context
    if (error instanceof McpError) {
      throw error;
    }

    throw new McpError(
      BaseErrorCode.INTERNAL_ERROR,
      `Failed to retrieve Obsidian commands: ${error instanceof Error ? error.message : "Unknown error"}`,
      { context },
    );
  }
}