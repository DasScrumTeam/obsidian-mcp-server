/**
 * @fileoverview Main export for the obsidianPublishHugoTool.
 * This file serves as the entry point for the MCP tool that triggers Hugo publishing.
 */

// Export the registration function for use in the MCP server setup
export { registerObsidianPublishHugoTool } from "./registration.js";

// Export types and schemas for use in other parts of the application
export type {
  ObsidianPublishHugoInput,
  ObsidianPublishHugoResponse,
  ObsidianPublishHugoRegistrationInput,
} from "./logic.js";

export {
  ObsidianPublishHugoInputSchema,
  ObsidianPublishHugoInputSchemaShape,
  processObsidianPublishHugo,
} from "./logic.js";
