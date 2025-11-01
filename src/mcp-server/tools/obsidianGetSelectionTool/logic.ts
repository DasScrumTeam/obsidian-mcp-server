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
 * Zod schema for validating the input parameters of the 'obsidian_get_selection' tool.
 * This tool requires no input parameters as it operates on the currently active editor.
 */
export const ObsidianGetSelectionInputSchema = z
  .object({})
  .describe(
    "Retrieves the currently selected text from the active Obsidian editor. No parameters required.",
  );

/**
 * TypeScript type inferred from the input schema (`ObsidianGetSelectionInputSchema`).
 * Represents the validated input parameters (empty object in this case).
 */
export type ObsidianGetSelectionInput = z.infer<
  typeof ObsidianGetSelectionInputSchema
>;

// ====================================================================================
// Input Schema Shape for MCP Registration
// ====================================================================================

/**
 * The base shape of the input schema, used for MCP tool registration.
 */
export const ObsidianGetSelectionInputSchemaShape = z.object({}).shape;

// ====================================================================================
// Response Type Definition
// ====================================================================================

/**
 * Defines the structure of the successful response returned by the `processObsidianGetSelection` function.
 * This matches the SelectionResponse interface from the editorMethods service.
 */
export interface ObsidianGetSelectionResponse {
  /**
   * Whether any text is currently selected in the active editor.
   */
  selected: boolean;
  /**
   * The selected text content (empty string if no selection).
   */
  text: string;
  /**
   * Path to the active file (null if no active file or editor).
   */
  file: string | null;
}

// ====================================================================================
// Core Logic Function
// ====================================================================================

/**
 * Processes the core logic for retrieving the currently selected text from Obsidian's active editor.
 *
 * This function calls the REST API endpoint provided by the AME3Helper plugin's REST API extension.
 * The endpoint returns information about whether text is selected, the selected text, and the active file path.
 *
 * @param {ObsidianGetSelectionInput} _params - The validated input parameters (empty object, unused).
 * @param {RequestContext} context - The request context for logging and correlation.
 * @param {ObsidianRestApiService} obsidianService - An instance of the Obsidian REST API service.
 * @returns {Promise<ObsidianGetSelectionResponse>} A promise resolving to the selection information.
 * @throws {McpError} Throws an McpError if there's no active editor or if the API interaction fails.
 */
export const processObsidianGetSelection = async (
  _params: ObsidianGetSelectionInput,
  context: RequestContext,
  obsidianService: ObsidianRestApiService,
): Promise<ObsidianGetSelectionResponse> => {
  logger.debug(
    "Processing obsidian_get_selection request for active editor",
    context,
  );

  const shouldRetryNotFound = (err: unknown) =>
    err instanceof McpError && err.code === BaseErrorCode.NOT_FOUND;

  try {
    // Call the service method to get the current selection
    const selectionContext = { ...context, operation: "getActiveSelection" };
    logger.debug("Attempting to get active selection", selectionContext);

    const selectionResponse = await retryWithDelay(
      () => obsidianService.getActiveSelection(selectionContext),
      {
        operationName: "getActiveSelectionWithRetry",
        context: selectionContext,
        maxRetries: 3,
        delayMs: 300,
        shouldRetry: shouldRetryNotFound,
      },
    );

    logger.debug(
      `Successfully retrieved selection. Selected: ${selectionResponse.selected}, File: ${selectionResponse.file || "N/A"}`,
      selectionContext,
    );

    return selectionResponse;
  } catch (error) {
    // Catch any errors that propagated up
    if (error instanceof McpError) {
      logger.error(
        `McpError during get selection process: ${error.message}`,
        error,
        context,
      );
      throw error; // Re-throw McpError
    } else {
      // Wrap unexpected errors in a generic McpError
      const errorMessage = "Unexpected error processing get selection request";
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
