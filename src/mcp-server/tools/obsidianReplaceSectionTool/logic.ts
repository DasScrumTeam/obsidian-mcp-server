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
 * Represents a position in the editor (0-indexed)
 */
const EditorPositionSchema = z.object({
  line: z.number().int().min(0).describe("0-indexed line number"),
  ch: z.number().int().min(0).describe("0-indexed character position within line"),
});

/**
 * Represents the start and end positions of a selection
 */
const SelectionPositionsSchema = z.object({
  start: EditorPositionSchema.describe("Start position of selection"),
  end: EditorPositionSchema.describe("End position of selection"),
});

/**
 * Zod schema for validating the input parameters of the 'obsidian_replace_section' tool.
 */
export const ObsidianReplaceSectionInputSchema = z
  .object({
    file: z
      .string()
      .min(1)
      .describe(
        "Expected file path (vault-relative, e.g., 'System/Rules/Rule 1.md'). Must match the currently active file.",
      ),
    newText: z.string().describe("New text to insert at the specified positions."),
    positions: SelectionPositionsSchema.describe(
      "Position range to replace. Coordinates are 0-indexed.",
    ),
    expectedText: z
      .string()
      .describe(
        "Expected text at the specified positions. Used for validation to ensure content hasn't changed. REQUIRED for safety.",
      ),
    origin: z
      .string()
      .optional()
      .describe(
        "Optional origin string for undo history tracking. Defaults to 'obsidian-mcp-server' if not provided.",
      ),
  })
  .describe(
    "Replace text at specific positions in the active Obsidian editor with fail-safe validation.",
  );

/**
 * TypeScript type inferred from the input schema
 */
export type ObsidianReplaceSectionInput = z.infer<
  typeof ObsidianReplaceSectionInputSchema
>;

// ====================================================================================
// Input Schema Shape for MCP Registration
// ====================================================================================

/**
 * The base shape of the input schema, used for MCP tool registration.
 */
export const ObsidianReplaceSectionInputSchemaShape =
  ObsidianReplaceSectionInputSchema.shape;

// ====================================================================================
// Response Type Definition
// ====================================================================================

/**
 * Represents a position in the editor (0-indexed)
 */
export interface EditorPosition {
  /** 0-indexed line number */
  line: number;
  /** 0-indexed character position within line */
  ch: number;
}

/**
 * Represents the start and end positions of a selection
 */
export interface SelectionPositions {
  /** Start position of selection */
  start: EditorPosition;
  /** End position of selection */
  end: EditorPosition;
}

/**
 * Defines the structure of the successful response returned by the `processObsidianReplaceSection` function.
 */
export interface ObsidianReplaceSectionResponse {
  /**
   * Whether the operation succeeded
   */
  success: boolean;
  /**
   * File path where replacement occurred
   */
  file: string;
  /**
   * The text that was replaced
   */
  replacedText: string;
  /**
   * The new text that was inserted
   */
  newText: string;
  /**
   * Final positions after replacement
   */
  positions: SelectionPositions;
}

// ====================================================================================
// Core Logic Function
// ====================================================================================

/**
 * Processes the core logic for replacing text at specific positions in the active editor.
 *
 * This function performs fail-safe validation before replacing text:
 * 1. Active editor exists
 * 2. File path matches expected
 * 3. Positions are within bounds
 * 4. Content at positions matches expectedText
 *
 * @param params - The validated input parameters
 * @param context - The request context for logging and correlation
 * @param obsidianService - An instance of the Obsidian REST API service
 * @returns A promise resolving to the replacement result
 * @throws Throws an McpError if validation fails or the operation fails
 */
export const processObsidianReplaceSection = async (
  params: ObsidianReplaceSectionInput,
  context: RequestContext,
  obsidianService: ObsidianRestApiService,
): Promise<ObsidianReplaceSectionResponse> => {
  const { file, newText, positions, expectedText, origin } = params;

  logger.debug(
    `Processing obsidian_replace_section request. File: ${file}, Expected text length: ${expectedText.length}`,
    { ...context, file, positions },
  );

  const shouldRetryNotFound = (err: unknown) =>
    err instanceof McpError && err.code === BaseErrorCode.NOT_FOUND;

  try {
    // Call the service method to replace the section
    const replaceContext = { ...context, operation: "replaceActiveSection" };
    logger.debug("Attempting to replace section", replaceContext);

    const replaceResponse = await retryWithDelay(
      () =>
        obsidianService.replaceActiveSection(replaceContext, {
          file,
          newText,
          positions,
          expectedText,
          origin,
        }),
      {
        operationName: "replaceActiveSectionWithRetry",
        context: replaceContext,
        maxRetries: 3,
        delayMs: 300,
        shouldRetry: shouldRetryNotFound,
      },
    );

    logger.debug(
      `Successfully replaced section. Replaced ${expectedText.length} chars with ${newText.length} chars`,
      replaceContext,
    );

    return replaceResponse;
  } catch (error) {
    // Catch any errors that propagated up
    if (error instanceof McpError) {
      logger.error(
        `McpError during replace section process: ${error.message}`,
        error,
        context,
      );
      throw error; // Re-throw McpError
    } else {
      // Wrap unexpected errors in a generic McpError
      const errorMessage =
        "Unexpected error processing replace section request";
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
