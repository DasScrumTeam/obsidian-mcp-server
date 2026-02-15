/**
 * @fileoverview Editor-related methods for interacting with Obsidian's active editor.
 * These methods extend the Obsidian REST API with editor-specific functionality
 * provided by the AME3Helper plugin's REST API extension.
 */

import { RequestContext } from '../../../utils/index.js';
import { RequestFunction } from '../types.js';

/**
 * Represents a position in the editor (0-indexed)
 */
export interface EditorPosition {
  /** 0-indexed line number */
  line: number;
  /** 0-indexed character position within line */
  ch: number;
}

/**
 * Represents the start and end positions of a selection
 */
export interface SelectionPositions {
  /** Start position of selection */
  start: EditorPosition;
  /** End position of selection */
  end: EditorPosition;
}

/**
 * Response from the /active/selection/ endpoint
 */
export interface SelectionResponse {
  /** Whether any text is currently selected */
  selected: boolean;
  /** The selected text content (empty string if no selection) */
  text: string;
  /** Path to the active file (null if no active file) */
  file: string | null;
  /** Position information (null if no selection) */
  positions: SelectionPositions | null;
}

/**
 * Response from the /active/note/ endpoint
 */
export interface ActiveNoteResponse {
  /** Vault-relative path of the active markdown file (null if no active file) */
  file: string | null;
}

/**
 * Get the vault-relative path of the currently active markdown file.
 *
 * This method calls the /active/note/ endpoint provided by the AME3Helper
 * plugin's REST API extension.
 *
 * @param _request - The HTTP request function from the service
 * @param context - Request context for logging and correlation
 * @returns Promise resolving to the active note response
 * @throws Error if no active file or if the endpoint is not available
 */
export async function getActiveNote(
  _request: RequestFunction,
  context: RequestContext,
): Promise<ActiveNoteResponse> {
  return _request<ActiveNoteResponse>(
    {
      method: 'GET',
      url: '/active/note/',
    },
    context,
    'getActiveNote',
  );
}

/**
 * Get the currently selected text in the active Obsidian editor.
 *
 * This method calls the /active/selection/ endpoint provided by the AME3Helper
 * plugin's REST API extension.
 *
 * @param _request - The HTTP request function from the service
 * @param context - Request context for logging and correlation
 * @returns Promise resolving to the selection response
 * @throws Error if no active editor or if the endpoint is not available
 */
export async function getActiveSelection(
  _request: RequestFunction,
  context: RequestContext,
): Promise<SelectionResponse> {
  return _request<SelectionResponse>(
    {
      method: 'GET',
      url: '/active/selection/',
    },
    context,
    'getActiveSelection',
  );
}

/**
 * Request parameters for replacing text at specific positions
 */
export interface ReplaceRangeRequest {
  /** Expected file path (vault-relative) */
  file: string;
  /** New text to insert */
  newText: string;
  /** Position range to replace */
  positions: SelectionPositions;
  /** Expected text at positions (for validation) */
  expectedText: string;
  /** Optional origin for undo history */
  origin?: string;
}

/**
 * Response from the /active/replace-range/ endpoint
 */
export interface ReplaceRangeResponse {
  /** Whether the operation succeeded */
  success: boolean;
  /** File path where replacement occurred */
  file: string;
  /** The text that was replaced */
  replacedText: string;
  /** The new text that was inserted */
  newText: string;
  /** Final positions after replacement */
  positions: SelectionPositions;
}

/**
 * Replace text at specific positions in the active Obsidian editor.
 *
 * This method calls the /active/replace-range/ endpoint provided by the AME3Helper
 * plugin's REST API extension. It performs fail-safe validation including:
 * - Active editor exists
 * - File path matches expected
 * - Positions are within bounds
 * - Content at positions matches expectedText
 *
 * @param _request - The HTTP request function from the service
 * @param context - Request context for logging and correlation
 * @param params - Replacement parameters
 * @returns Promise resolving to the replacement response
 * @throws Error if validation fails or replacement operation fails
 */
export async function replaceActiveSection(
  _request: RequestFunction,
  context: RequestContext,
  params: ReplaceRangeRequest,
): Promise<ReplaceRangeResponse> {
  return _request<ReplaceRangeResponse>(
    {
      method: 'POST',
      url: '/active/replace-range/',
      data: params,
    },
    context,
    'replaceActiveSection',
  );
}

/**
 * Request parameters for connecting a session to the active note
 */
export interface ConnectSessionRequest {
  /** The Claude session ID to write into frontmatter */
  sessionId: string;
}

/**
 * Response from the /active/connect-session/ endpoint
 */
export interface ConnectSessionResponse {
  /** Vault-relative path of the connected file */
  file: string;
  /** The session ID that was written */
  sessionId: string;
}

/**
 * Connect a Claude session to the active Obsidian note.
 *
 * This method calls the /active/connect-session/ endpoint provided by the AME3Helper
 * plugin's REST API extension. It atomically writes the 'ai-claude-session' frontmatter
 * field using Obsidian's processFrontMatter API.
 *
 * @param _request - The HTTP request function from the service
 * @param context - Request context for logging and correlation
 * @param params - The session connection parameters
 * @returns Promise resolving to the connect session response
 * @throws Error if no active file, invalid sessionId, or frontmatter write fails
 */
export async function connectSession(
  _request: RequestFunction,
  context: RequestContext,
  params: ConnectSessionRequest,
): Promise<ConnectSessionResponse> {
  return _request<ConnectSessionResponse>(
    {
      method: 'POST',
      url: '/active/connect-session/',
      data: params,
    },
    context,
    'connectSession',
  );
}

/**
 * Request parameters for disconnecting a session from a note
 */
export interface DisconnectSessionRequest {
  /** Optional vault-relative path. If omitted, uses the active note. */
  filePath?: string;
}

/**
 * Response from the /active/disconnect-session/ endpoint
 */
export interface DisconnectSessionResponse {
  /** Vault-relative path of the disconnected file */
  file: string;
  /** Whether the disconnect succeeded */
  disconnected: boolean;
}

/**
 * Disconnect a Claude session from an Obsidian note.
 *
 * This method calls the /active/disconnect-session/ endpoint provided by the AME3Helper
 * plugin's REST API extension. It atomically removes the 'ai-claude-session' frontmatter
 * field using Obsidian's processFrontMatter API.
 *
 * @param _request - The HTTP request function from the service
 * @param context - Request context for logging and correlation
 * @param params - Optional parameters (filePath to target a specific note)
 * @returns Promise resolving to the disconnect session response
 * @throws Error if file not found or frontmatter write fails
 */
export async function disconnectSession(
  _request: RequestFunction,
  context: RequestContext,
  params: DisconnectSessionRequest,
): Promise<DisconnectSessionResponse> {
  return _request<DisconnectSessionResponse>(
    {
      method: 'POST',
      url: '/active/disconnect-session/',
      data: params,
    },
    context,
    'disconnectSession',
  );
}
