import { z } from "zod";
import { ObsidianRestApiService } from "../../../services/obsidianRestAPI/index.js";
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
 * Zod schema for validating the input parameters of the 'obsidian_get_active_note' tool.
 * This tool requires no input parameters.
 */
export const ObsidianGetActiveNoteInputSchema = z
  .object({})
  .describe(
    "Retrieves the vault-relative path of the currently active markdown file in Obsidian. No parameters required.",
  );

/**
 * TypeScript type inferred from the input schema.
 */
export type ObsidianGetActiveNoteInput = z.infer<
  typeof ObsidianGetActiveNoteInputSchema
>;

// ====================================================================================
// Input Schema Shape for MCP Registration
// ====================================================================================

/**
 * The base shape of the input schema, used for MCP tool registration.
 */
export const ObsidianGetActiveNoteInputSchemaShape = z.object({}).shape;

// ====================================================================================
// Response Type Definition
// ====================================================================================

/**
 * Defines the structure of the successful response returned by the `processObsidianGetActiveNote` function.
 */
export interface ObsidianGetActiveNoteResponse {
  /**
   * Vault-relative path of the active markdown file (null if no active file).
   */
  file: string | null;
}

// ====================================================================================
// Core Logic Function
// ====================================================================================

/**
 * Processes the core logic for retrieving the active note path from Obsidian.
 *
 * This function calls the REST API endpoint provided by the AME3Helper plugin's REST API extension.
 * The endpoint returns the vault-relative path of the currently active markdown file.
 *
 * @param _params - The validated input parameters (empty object, unused).
 * @param context - The request context for logging and correlation.
 * @param obsidianService - An instance of the Obsidian REST API service.
 * @returns A promise resolving to the active note information.
 * @throws McpError if there's no active file or if the API interaction fails.
 */
export const processObsidianGetActiveNote = async (
  _params: ObsidianGetActiveNoteInput,
  context: RequestContext,
  obsidianService: ObsidianRestApiService,
): Promise<ObsidianGetActiveNoteResponse> => {
  logger.debug(
    "Processing obsidian_get_active_note request",
    context,
  );

  const shouldRetryNotFound = (err: unknown) =>
    err instanceof McpError && err.code === BaseErrorCode.NOT_FOUND;

  try {
    const activeNoteContext = { ...context, operation: "getActiveNote" };
    logger.debug("Attempting to get active note", activeNoteContext);

    const response = await retryWithDelay(
      () => obsidianService.getActiveNote(activeNoteContext),
      {
        operationName: "getActiveNoteWithRetry",
        context: activeNoteContext,
        maxRetries: 3,
        delayMs: 300,
        shouldRetry: shouldRetryNotFound,
      },
    );

    logger.debug(
      `Successfully retrieved active note: ${response.file || "N/A"}`,
      activeNoteContext,
    );

    return response;
  } catch (error) {
    if (error instanceof McpError) {
      logger.error(
        `McpError during get active note: ${error.message}`,
        error,
        context,
      );
      throw error;
    } else {
      const errorMessage = "Unexpected error processing get active note request";
      logger.error(
        errorMessage,
        error instanceof Error ? error : undefined,
        context,
      );
      throw new McpError(
        BaseErrorCode.INTERNAL_ERROR,
        `${errorMessage}: ${error instanceof Error ? error.message : String(error)}`,
        context,
      );
    }
  }
};
