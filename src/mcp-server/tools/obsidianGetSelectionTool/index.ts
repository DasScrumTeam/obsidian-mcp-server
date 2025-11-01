/**
 * @fileoverview Barrel file for the 'obsidian_get_selection' MCP tool.
 *
 * This file serves as the public entry point for the obsidian_get_selection tool module.
 * It re-exports the primary registration function (`registerObsidianGetSelectionTool`)
 * from the './registration.js' module. This pattern simplifies imports for consumers
 * of the tool, allowing them to import necessary components from a single location.
 *
 * Consumers (like the main server setup) should import the registration function
 * from this file to integrate the tool into the MCP server instance.
 */
export { registerObsidianGetSelectionTool } from "./registration.js";
