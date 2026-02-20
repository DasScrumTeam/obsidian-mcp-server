import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ObsidianRestApiService } from "../../../services/obsidianRestAPI/index.js";
import { BaseErrorCode, McpError } from "../../../types-global/errors.js";
import {
  ErrorHandler,
  logger,
  RequestContext,
  requestContextService,
} from "../../../utils/index.js";
import type {
  ObsidianPublishQuartoRegistrationInput,
  ObsidianPublishQuartoResponse,
} from "./logic.js";
import {
  ObsidianPublishQuartoInputSchema,
  ObsidianPublishQuartoInputSchemaShape,
  processObsidianPublishQuarto,
} from "./logic.js";

export const registerObsidianPublishQuartoTool = async (
  server: McpServer,
  obsidianService: ObsidianRestApiService,
): Promise<void> => {
  const toolName = "obsidian_publish_quarto";
  const toolDescription =
    "Triggers a full Quarto publish workflow in the AME3Helper plugin. Exports all vault files with 'bookpublish: true' frontmatter to the configured Quarto output directory. Returns structured results with success status, chapter count, image count, warnings, and duration. Requires the AME3Helper plugin with REST API extension to be active.";

  const registrationContext: RequestContext =
    requestContextService.createRequestContext({
      operation: "RegisterObsidianPublishQuartoTool",
      toolName: toolName,
      module: "ObsidianPublishQuartoRegistration",
    });

  logger.info(`Attempting to register tool: ${toolName}`, registrationContext);

  await ErrorHandler.tryCatch(
    async () => {
      server.tool(
        toolName,
        toolDescription,
        ObsidianPublishQuartoInputSchemaShape,
        async (params: ObsidianPublishQuartoRegistrationInput) => {
          const handlerContext: RequestContext =
            requestContextService.createRequestContext({
              parentContext: registrationContext,
              operation: "HandleObsidianPublishQuartoRequest",
              toolName: toolName,
              params: {},
            });
          logger.debug(`Handling '${toolName}' request`, handlerContext);

          return await ErrorHandler.tryCatch(
            async () => {
              const validatedParams =
                ObsidianPublishQuartoInputSchema.parse(params);

              const response: ObsidianPublishQuartoResponse =
                await processObsidianPublishQuarto(
                  validatedParams,
                  handlerContext,
                  obsidianService,
                );
              logger.debug(
                `'${toolName}' processed successfully. Success: ${response.success}`,
                handlerContext,
              );

              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(response, null, 2),
                  },
                ],
                isError: false,
              };
            },
            {
              operation: `processing ${toolName} handler`,
              context: handlerContext,
              input: params,
              errorMapper: (error: unknown) =>
                new McpError(
                  error instanceof McpError
                    ? error.code
                    : BaseErrorCode.INTERNAL_ERROR,
                  `Error processing ${toolName} tool: ${error instanceof Error ? error.message : "Unknown error"}`,
                  { ...handlerContext },
                ),
            },
          );
        },
      );

      logger.info(
        `Tool registered successfully: ${toolName}`,
        registrationContext,
      );
    },
    {
      operation: `registering tool ${toolName}`,
      context: registrationContext,
      errorCode: BaseErrorCode.INTERNAL_ERROR,
      errorMapper: (error: unknown) =>
        new McpError(
          error instanceof McpError ? error.code : BaseErrorCode.INTERNAL_ERROR,
          `Failed to register tool '${toolName}': ${error instanceof Error ? error.message : "Unknown error"}`,
          { ...registrationContext },
        ),
      critical: true,
    },
  );
};
