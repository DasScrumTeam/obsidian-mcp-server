/**
 * @fileoverview Main export for the obsidianExecuteCommandTool.
 * This file serves as the entry point for the MCP tool that executes specific Obsidian commands.
 *
 * The tool enables AI agents to trigger Obsidian actions like copying as HTML, publishing
 * to Hugo, exporting to PDF, and other command-based functionality with timeout controls
 * and comprehensive execution feedback.
 */

// Export the registration function for use in the MCP server setup
export { registerObsidianExecuteCommandTool } from "./registration.js";

// Export types and schemas for use in other parts of the application
export type {
  ObsidianExecuteCommandInput,
  ObsidianExecuteCommandResponse,
  ObsidianExecuteCommandRegistrationInput,
} from "./logic.js";

export {
  ObsidianExecuteCommandInputSchema,
  ObsidianExecuteCommandResponseSchema,
  processObsidianExecuteCommand,
} from "./logic.js";