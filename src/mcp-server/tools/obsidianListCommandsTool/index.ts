/**
 * @fileoverview Main export for the obsidianListCommandsTool.
 * This file serves as the entry point for the MCP tool that lists available Obsidian commands.
 *
 * The tool enables AI agents to discover what commands can be executed in Obsidian,
 * supporting filtering and categorization for efficient command discovery workflows.
 */

// Export the registration function for use in the MCP server setup
export { registerObsidianListCommandsTool } from "./registration.js";

// Export types and schemas for use in other parts of the application
export type {
  ObsidianListCommandsInput,
  ObsidianListCommandsResponse,
  ObsidianListCommandsRegistrationInput,
} from "./logic.js";

export {
  ObsidianListCommandsInputSchema,
  ObsidianListCommandsResponseSchema,
  processObsidianListCommands,
} from "./logic.js";