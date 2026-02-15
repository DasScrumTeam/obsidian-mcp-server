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
 * Zod schema for validating the input parameters of the 'obsidian_connect_session' tool.
 */
export const ObsidianConnectSessionInputSchema = z
  .object({
    sessionId: z
      .string()
      .min(1, "sessionId must be a non-empty string")
      .describe("The Claude session ID to write into the active note's frontmatter"),
  })
  .describe(
    "Connects a Claude session to the currently active Obsidian note by writing 'ai-claude-session' frontmatter.",
  );

/**
 * TypeScript type inferred from the input schema.
 */
export type ObsidianConnectSessionInput = z.infer<
  typeof ObsidianConnectSessionInputSchema
>;

// ====================================================================================
// Input Schema Shape for MCP Registration
// ====================================================================================

/**
 * The base shape of the input schema, used for MCP tool registration.
 */
export const ObsidianConnectSessionInputSchemaShape =
  ObsidianConnectSessionInputSchema.shape;

// ====================================================================================
// Response Type Definition
// ====================================================================================

/**
 * Defines the structure of the successful response returned by the `processObsidianConnectSession` function.
 */
export interface ObsidianConnectSessionResponse {
  /** Vault-relative path of the connected file */
  file: string;
  /** The session ID that was written */
  sessionId: string;
}

// ====================================================================================
// Core Logic Function
// ====================================================================================

/**
 * Processes the core logic for connecting a Claude session to the active Obsidian note.
 *
 * This function calls the REST API endpoint provided by the AME3Helper plugin's REST API extension.
 * The endpoint atomically writes the 'ai-claude-session' frontmatter field using Obsidian's
 * processFrontMatter API.
 *
 * @param params - The validated input parameters containing the sessionId.
 * @param context - The request context for logging and correlation.
 * @param obsidianService - An instance of the Obsidian REST API service.
 * @returns A promise resolving to the connect session response.
 * @throws McpError if there's no active file, invalid sessionId, or frontmatter write fails.
 */
export const processObsidianConnectSession = async (
  params: ObsidianConnectSessionInput,
  context: RequestContext,
  obsidianService: ObsidianRestApiService,
): Promise<ObsidianConnectSessionResponse> => {
  logger.debug(
    `Processing obsidian_connect_session request with sessionId: ${params.sessionId}`,
    context,
  );

  const shouldRetryNotFound = (err: unknown) =>
    err instanceof McpError && err.code === BaseErrorCode.NOT_FOUND;

  try {
    const connectContext = { ...context, operation: "connectSession" };
    logger.debug("Attempting to connect session to active note", connectContext);

    const response = await retryWithDelay(
      () =>
        obsidianService.connectSession(connectContext, {
          sessionId: params.sessionId,
        }),
      {
        operationName: "connectSessionWithRetry",
        context: connectContext,
        maxRetries: 3,
        delayMs: 300,
        shouldRetry: shouldRetryNotFound,
      },
    );

    logger.debug(
      `Successfully connected session ${response.sessionId} to ${response.file}`,
      connectContext,
    );

    return response;
  } catch (error) {
    if (error instanceof McpError) {
      logger.error(
        `McpError during connect session: ${error.message}`,
        error,
        context,
      );
      throw error;
    } else {
      const errorMessage =
        "Unexpected error processing connect session request";
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
