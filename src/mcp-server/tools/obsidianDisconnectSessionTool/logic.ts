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
 * Zod schema for validating the input parameters of the 'obsidian_disconnect_session' tool.
 */
export const ObsidianDisconnectSessionInputSchema = z
  .object({
    filePath: z
      .string()
      .min(1, "filePath must be a non-empty string if provided")
      .optional()
      .describe(
        "Vault-relative path of the note to disconnect. If omitted, uses the currently active note.",
      ),
  })
  .describe(
    "Disconnects a Claude session from an Obsidian note by removing the 'ai-claude-session' frontmatter field.",
  );

/**
 * TypeScript type inferred from the input schema.
 */
export type ObsidianDisconnectSessionInput = z.infer<
  typeof ObsidianDisconnectSessionInputSchema
>;

// ====================================================================================
// Input Schema Shape for MCP Registration
// ====================================================================================

/**
 * The base shape of the input schema, used for MCP tool registration.
 */
export const ObsidianDisconnectSessionInputSchemaShape =
  ObsidianDisconnectSessionInputSchema.shape;

// ====================================================================================
// Response Type Definition
// ====================================================================================

/**
 * Defines the structure of the successful response returned by the `processObsidianDisconnectSession` function.
 */
export interface ObsidianDisconnectSessionResponse {
  /** Vault-relative path of the disconnected file */
  file: string;
  /** Whether the disconnect succeeded */
  disconnected: boolean;
}

// ====================================================================================
// Core Logic Function
// ====================================================================================

/**
 * Processes the core logic for disconnecting a Claude session from an Obsidian note.
 *
 * This function calls the REST API endpoint provided by the AME3Helper plugin's REST API extension.
 * The endpoint atomically removes the 'ai-claude-session' frontmatter field using Obsidian's
 * processFrontMatter API.
 *
 * @param params - The validated input parameters (optional filePath).
 * @param context - The request context for logging and correlation.
 * @param obsidianService - An instance of the Obsidian REST API service.
 * @returns A promise resolving to the disconnect session response.
 * @throws McpError if the file is not found or frontmatter write fails.
 */
export const processObsidianDisconnectSession = async (
  params: ObsidianDisconnectSessionInput,
  context: RequestContext,
  obsidianService: ObsidianRestApiService,
): Promise<ObsidianDisconnectSessionResponse> => {
  logger.debug(
    `Processing obsidian_disconnect_session request${params.filePath ? ` for file: ${params.filePath}` : " (active note)"}`,
    context,
  );

  const shouldRetryNotFound = (err: unknown) =>
    err instanceof McpError && err.code === BaseErrorCode.NOT_FOUND;

  try {
    const disconnectContext = { ...context, operation: "disconnectSession" };
    logger.debug(
      "Attempting to disconnect session from note",
      disconnectContext,
    );

    const response = await retryWithDelay(
      () =>
        obsidianService.disconnectSession(disconnectContext, {
          filePath: params.filePath,
        }),
      {
        operationName: "disconnectSessionWithRetry",
        context: disconnectContext,
        maxRetries: 3,
        delayMs: 300,
        shouldRetry: shouldRetryNotFound,
      },
    );

    logger.debug(
      `Successfully disconnected session from ${response.file}`,
      disconnectContext,
    );

    return response;
  } catch (error) {
    if (error instanceof McpError) {
      logger.error(
        `McpError during disconnect session: ${error.message}`,
        error,
        context,
      );
      throw error;
    } else {
      const errorMessage =
        "Unexpected error processing disconnect session request";
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
