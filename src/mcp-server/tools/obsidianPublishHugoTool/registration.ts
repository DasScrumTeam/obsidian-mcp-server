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
  ObsidianPublishHugoRegistrationInput,
  ObsidianPublishHugoResponse,
} from "./logic.js";
import {
  ObsidianPublishHugoInputSchema,
  ObsidianPublishHugoInputSchemaShape,
  processObsidianPublishHugo,
} from "./logic.js";

export const registerObsidianPublishHugoTool = async (
  server: McpServer,
  obsidianService: ObsidianRestApiService,
): Promise<void> => {
  const toolName = "obsidian_publish_hugo";
  const toolDescription =
    "Triggers a full Hugo publish workflow in the AME3Helper plugin. Publishes all vault files with 'hugopublish: true' frontmatter to the configured Hugo site directory. Returns structured results with success status and duration. Requires the AME3Helper plugin with REST API extension to be active.";

  const registrationContext: RequestContext =
    requestContextService.createRequestContext({
      operation: "RegisterObsidianPublishHugoTool",
      toolName: toolName,
      module: "ObsidianPublishHugoRegistration",
    });

  logger.info(`Attempting to register tool: ${toolName}`, registrationContext);

  await ErrorHandler.tryCatch(
    async () => {
      server.tool(
        toolName,
        toolDescription,
        ObsidianPublishHugoInputSchemaShape,
        async (params: ObsidianPublishHugoRegistrationInput) => {
          const handlerContext: RequestContext =
            requestContextService.createRequestContext({
              parentContext: registrationContext,
              operation: "HandleObsidianPublishHugoRequest",
              toolName: toolName,
              params: {},
            });
          logger.debug(`Handling '${toolName}' request`, handlerContext);

          return await ErrorHandler.tryCatch(
            async () => {
              const validatedParams =
                ObsidianPublishHugoInputSchema.parse(params);

              const response: ObsidianPublishHugoResponse =
                await processObsidianPublishHugo(
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
