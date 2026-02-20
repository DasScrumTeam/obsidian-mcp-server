import { z } from "zod";
import { ObsidianRestApiService } from "../../../services/obsidianRestAPI/index.js";
import { BaseErrorCode, McpError } from "../../../types-global/errors.js";
import { logger, RequestContext } from "../../../utils/index.js";

export const ObsidianPublishHugoInputSchema = z
  .object({})
  .describe(
    "Triggers a full Hugo publish workflow. No parameters required.",
  );

export type ObsidianPublishHugoInput = z.infer<
  typeof ObsidianPublishHugoInputSchema
>;

export const ObsidianPublishHugoInputSchemaShape = z.object({}).shape;

export interface ObsidianPublishHugoResponse {
  success: boolean;
  duration: number;
  error?: string;
}

export type ObsidianPublishHugoRegistrationInput = ObsidianPublishHugoInput;

export const processObsidianPublishHugo = async (
  _params: ObsidianPublishHugoInput,
  context: RequestContext,
  obsidianService: ObsidianRestApiService,
): Promise<ObsidianPublishHugoResponse> => {
  logger.debug("Processing obsidian_publish_hugo request", context);

  try {
    const publishContext = { ...context, operation: "publishHugo" };
    logger.debug("Triggering Hugo publish", publishContext);

    const response = await obsidianService.publishHugo(publishContext);

    logger.debug(
      `Hugo publish completed. Success: ${response.success}, Duration: ${response.duration}ms`,
      publishContext,
    );

    return response;
  } catch (error) {
    if (error instanceof McpError) {
      logger.error(
        `McpError during Hugo publish: ${error.message}`,
        error,
        context,
      );
      throw error;
    } else {
      const errorMessage = "Unexpected error during Hugo publish";
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
