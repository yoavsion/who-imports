import type { DependencyGraphOutput, ExportDependencyInfo } from '../types.js';

/**
 * Format dependency info as JSON
 */
export function formatAsJson(exports: ExportDependencyInfo[]): string {
  const output: DependencyGraphOutput = { exports };
  return JSON.stringify(output, null, 2);
}
