import { z } from "zod";
import {
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
 * Zod schema for validating the input parameters of the 'obsidian_execute_command' tool.
 */
export const ObsidianExecuteCommandInputSchema = z
  .object({
    /**
     * The exact command ID to execute (e.g., "copy-as-html:copy-as-html-command").
     * Must match a command available in Obsidian.
     */
    commandId: z
      .string()
      .min(1, "commandId cannot be empty")
      .describe(
        'The exact command ID to execute (e.g., "copy-as-html:copy-as-html-command", "ame3-helper:publish-to-hugo").',
      ),
    /**
     * Whether to wait for command completion (for async commands).
     * Some commands may execute asynchronously, this controls waiting behavior.
     */
    waitForCompletion: z
      .boolean()
      .default(true)
      .describe(
        "Whether to wait for async command completion. Defaults to true.",
      ),
    /**
     * Timeout for command execution in milliseconds.
     * Prevents hanging on long-running or stuck commands.
     */
    timeout: z
      .number()
      .int()
      .min(1000, "Timeout must be at least 1000ms")
      .max(30000, "Timeout cannot exceed 30000ms (30 seconds)")
      .default(5000)
      .describe(
        "Timeout for command execution in milliseconds (1000-30000). Defaults to 5000ms.",
      ),
  })
  .describe("Parameters for executing a specific Obsidian command");

/**
 * TypeScript type derived from the input schema for use in function signatures.
 */
export type ObsidianExecuteCommandInput = z.infer<
  typeof ObsidianExecuteCommandInputSchema
>;

// ====================================================================================
// Output Response Schema and Types
// ====================================================================================

/**
 * Schema for error information in command execution responses.
 */
export const CommandExecutionErrorSchema = z.object({
  code: z.string().describe("Error code categorizing the failure"),
  details: z.string().describe("Detailed error message"),
});

/**
 * Zod schema for the response structure of the 'obsidian_execute_command' tool.
 */
export const ObsidianExecuteCommandResponseSchema = z.object({
  success: z.boolean().describe("Whether the command executed successfully"),
  commandId: z.string().describe("The command ID that was executed"),
  commandName: z
    .string()
    .optional()
    .describe("The display name of the command (if resolved)"),
  executionTime: z
    .number()
    .describe("Command execution duration in milliseconds"),
  message: z.string().describe("Success message or error description"),
  timestamp: z.string().describe("ISO timestamp of when the command was executed"),
  error: CommandExecutionErrorSchema
    .optional()
    .describe("Error details if execution failed"),
});

/**
 * TypeScript type for the tool's response structure.
 */
export type ObsidianExecuteCommandResponse = z.infer<
  typeof ObsidianExecuteCommandResponseSchema
>;

// ====================================================================================
// Input Schema Shape for MCP Registration
// ====================================================================================

/**
 * The base shape of the input schema, used for MCP tool registration.
 * This is passed to the MCP server's tool registration method.
 */
export const ObsidianExecuteCommandInputSchemaShape =
  ObsidianExecuteCommandInputSchema.shape;

/**
 * Type for the raw input parameters received during tool registration.
 */
export type ObsidianExecuteCommandRegistrationInput = {
  [K in keyof ObsidianExecuteCommandInput]: ObsidianExecuteCommandInput[K];
};

// ====================================================================================
// Core Processing Logic
// ====================================================================================

/**
 * Attempts to resolve the command display name from the command ID.
 * This is optional and used for better error reporting.
 * @param commandId - The command ID to resolve
 * @param obsidianService - Service instance for API calls
 * @param context - Request context
 * @returns The command display name or undefined if not found
 */
async function resolveCommandName(
  commandId: string,
  obsidianService: ObsidianRestApiService,
  context: RequestContext,
): Promise<string | undefined> {
  try {
    const commands = await obsidianService.listCommands(context);
    const command = commands.find((cmd) => cmd.id === commandId);
    return command?.name;
  } catch (error) {
    // Log warning but don't fail execution for name resolution
    logger.warning("Could not resolve command name", {
      ...context,
      commandId,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

/**
 * Executes the command with timeout handling.
 * @param commandId - The command ID to execute
 * @param timeout - Timeout in milliseconds
 * @param obsidianService - Service instance for API calls
 * @param context - Request context
 * @returns Promise that resolves when command completes or times out
 */
async function executeCommandWithTimeout(
  commandId: string,
  timeout: number,
  obsidianService: ObsidianRestApiService,
  context: RequestContext,
): Promise<void> {
  // Create a timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Command execution timed out after ${timeout}ms`));
    }, timeout);
  });

  // Execute the command with timeout race
  await Promise.race([
    obsidianService.executeCommand(commandId, context),
    timeoutPromise,
  ]);
}

/**
 * Main processing function for the 'obsidian_execute_command' tool.
 * Executes the specified Obsidian command with timeout and error handling.
 *
 * @param params - Validated input parameters from the client request.
 * @param context - Request context for logging and correlation.
 * @param obsidianService - Service instance for interacting with the Obsidian REST API.
 * @returns Promise resolving to a structured response with execution results.
 * @throws {McpError} If command execution fails or parameters are invalid.
 */
export async function processObsidianExecuteCommand(
  params: ObsidianExecuteCommandInput,
  context: RequestContext,
  obsidianService: ObsidianRestApiService,
): Promise<ObsidianExecuteCommandResponse> {
  const startTime = Date.now();

  logger.info("Processing obsidian_execute_command request", {
    ...context,
    commandId: params.commandId,
    timeout: params.timeout,
    waitForCompletion: params.waitForCompletion,
  });

  try {
    // Resolve command name for better reporting (non-blocking)
    const commandName = await resolveCommandName(
      params.commandId,
      obsidianService,
      context,
    );

    if (!commandName) {
      logger.warning("Command ID not found in available commands list", {
        ...context,
        commandId: params.commandId,
      });
    }

    // Execute the command with timeout and retry logic
    await retryWithDelay(
      async () => {
        await executeCommandWithTimeout(
          params.commandId,
          params.timeout,
          obsidianService,
          context,
        );
      },
      {
        operationName: "executeObsidianCommand",
        context,
        maxRetries: 1, // Only retry once for command execution
        delayMs: 500,
      },
    );

    const executionTime = Date.now() - startTime;

    // Build successful response
    const response: ObsidianExecuteCommandResponse = {
      success: true,
      commandId: params.commandId,
      commandName,
      executionTime,
      message: `Command '${commandName || params.commandId}' executed successfully`,
      timestamp: new Date().toISOString(),
    };

    logger.info("Successfully executed Obsidian command", {
      ...context,
      commandId: params.commandId,
      commandName,
      executionTime,
    });

    return response;
  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error("Error executing Obsidian command", {
      ...context,
      commandId: params.commandId,
      error: errorMessage,
      executionTime,
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Determine error code based on error type
    let errorCode = BaseErrorCode.INTERNAL_ERROR;
    let errorDetails = errorMessage;

    if (errorMessage.includes("timed out")) {
      errorCode = BaseErrorCode.TIMEOUT;
      errorDetails = `Command execution timed out after ${params.timeout}ms`;
    } else if (errorMessage.includes("not found") || errorMessage.includes("404")) {
      errorCode = BaseErrorCode.NOT_FOUND;
      errorDetails = `Command '${params.commandId}' not found or not available`;
    } else if (errorMessage.includes("403") || errorMessage.includes("unauthorized")) {
      errorCode = BaseErrorCode.UNAUTHORIZED;
      errorDetails = "Permission denied or API key invalid";
    }

    // Build error response
    const response: ObsidianExecuteCommandResponse = {
      success: false,
      commandId: params.commandId,
      executionTime,
      message: `Failed to execute command '${params.commandId}': ${errorDetails}`,
      timestamp: new Date().toISOString(),
      error: {
        code: errorCode,
        details: errorDetails,
      },
    };

    // For certain errors, return response instead of throwing
    if (errorCode === BaseErrorCode.NOT_FOUND) {
      return response;
    }

    // For other errors, throw McpError
    throw new McpError(
      errorCode,
      `Failed to execute Obsidian command '${params.commandId}': ${errorDetails}`,
      { context, response },
    );
  }
}