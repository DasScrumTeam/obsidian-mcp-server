/**
 * @fileoverview Main export for the obsidianPublishQuartoTool.
 * This file serves as the entry point for the MCP tool that triggers Quarto publishing.
 */

// Export the registration function for use in the MCP server setup
export { registerObsidianPublishQuartoTool } from "./registration.js";

// Export types and schemas for use in other parts of the application
export type {
  ObsidianPublishQuartoInput,
  ObsidianPublishQuartoResponse,
  ObsidianPublishQuartoRegistrationInput,
} from "./logic.js";

export {
  ObsidianPublishQuartoInputSchema,
  ObsidianPublishQuartoInputSchemaShape,
  processObsidianPublishQuarto,
} from "./logic.js";
