import { z } from "zod";
import { ObsidianRestApiService } from "../../../services/obsidianRestAPI/index.js";
import { BaseErrorCode, McpError } from "../../../types-global/errors.js";
import { logger, RequestContext } from "../../../utils/index.js";

export const ObsidianPublishQuartoInputSchema = z
  .object({})
  .describe(
    "Triggers a full Quarto publish workflow. No parameters required.",
  );

export type ObsidianPublishQuartoInput = z.infer<
  typeof ObsidianPublishQuartoInputSchema
>;

export const ObsidianPublishQuartoInputSchemaShape = z.object({}).shape;

export interface ObsidianPublishQuartoResponse {
  success: boolean;
  chapters: number;
  images: number;
  warnings: string[];
  duration: number;
  error?: string;
}

export type ObsidianPublishQuartoRegistrationInput = ObsidianPublishQuartoInput;

export const processObsidianPublishQuarto = async (
  _params: ObsidianPublishQuartoInput,
  context: RequestContext,
  obsidianService: ObsidianRestApiService,
): Promise<ObsidianPublishQuartoResponse> => {
  logger.debug("Processing obsidian_publish_quarto request", context);

  try {
    const publishContext = { ...context, operation: "publishQuarto" };
    logger.debug("Triggering Quarto publish", publishContext);

    const response = await obsidianService.publishQuarto(publishContext);

    logger.debug(
      `Quarto publish completed. Success: ${response.success}, Chapters: ${response.chapters}, Images: ${response.images}, Duration: ${response.duration}ms`,
      publishContext,
    );

    return response;
  } catch (error) {
    if (error instanceof McpError) {
      logger.error(
        `McpError during Quarto publish: ${error.message}`,
        error,
        context,
      );
      throw error;
    } else {
      const errorMessage = "Unexpected error during Quarto publish";
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
