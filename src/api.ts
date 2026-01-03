/**
 * Programmatic API for who-imports
 *
 * @example
 * ```typescript
 * import {
 *   parseFiles,
 *   buildExportRegistry,
 *   findConsumers,
 *   buildDependencyOutput,
 *   formatAsJson,
 * } from 'who-imports';
 *
 * const { files, basePath } = parseFiles(['./src']);
 * const registry = buildExportRegistry(files, basePath);
 * const consumers = findConsumers(files, registry, basePath);
 * const output = buildDependencyOutput(registry, consumers, files, basePath);
 * console.log(formatAsJson(output));
 * ```
 */

// Types
export type {
  ResolvedExport,
  ExportEntry,
  Consumer,
  ExportDependencyInfo,
  DependencyGraphOutput,
} from './types.js';

// Parser
export { parseFiles, addFilesToProject, findCommonAncestor } from './parser.js';

// Exports
export type { ExportRegistry } from './exports.js';
export { buildExportRegistry, resolveExport, getAllExportsFromModule } from './exports.js';

// Consumers
export type { ConsumerMap } from './consumers.js';
export { findConsumers, buildDependencyOutput } from './consumers.js';

// Output formatters
export { formatAsJson } from './output/json.js';
export { formatAsDot } from './output/dot.js';
