/**
 * @fileoverview Editor-related methods for interacting with Obsidian's active editor.
 * These methods extend the Obsidian REST API with editor-specific functionality
 * provided by the AME3Helper plugin's REST API extension.
 */

import { RequestContext } from '../../../utils/index.js';
import { RequestFunction } from '../types.js';

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
