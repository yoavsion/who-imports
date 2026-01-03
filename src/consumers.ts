import { SourceFile, ImportDeclaration, SyntaxKind, Identifier } from 'ts-morph';
import * as path from 'path';
import type { Consumer, ExportDependencyInfo } from './types.js';
import { ExportRegistry, resolveExport } from './exports.js';

/**
 * Map of original export key to its consumers
 * Key format: "originalModule::exportName"
 */
export type ConsumerMap = Map<string, Consumer[]>;

/**
 * Find all consumers of exports within the analyzed files
 * @param allFiles - All files in the project (for import resolution)
 * @param registry - Export registry to look up exports
 * @param basePath - Base path for relative paths
 * @param consumerFiles - Optional subset of files to scan for consumers. Defaults to allFiles.
 */
export function findConsumers(
  allFiles: Map<string, SourceFile>,
  registry: ExportRegistry,
  basePath: string,
  consumerFiles?: Map<string, SourceFile>
): ConsumerMap {
  const consumers: ConsumerMap = new Map();
  const filesToScan = consumerFiles ?? allFiles;

  for (const [filePath, sourceFile] of filesToScan) {
    const consumerModule = path.relative(basePath, filePath);
    processImportsInFile(sourceFile, consumerModule, registry, allFiles, basePath, consumers);
  }

  return consumers;
}

/**
 * Process all imports in a single file
 */
function processImportsInFile(
  sourceFile: SourceFile,
  consumerModule: string,
  registry: ExportRegistry,
  files: Map<string, SourceFile>,
  basePath: string,
  consumers: ConsumerMap
): void {
  for (const importDecl of sourceFile.getImportDeclarations()) {
    processImportDeclaration(
      importDecl,
      consumerModule,
      registry,
      files,
      basePath,
      consumers,
      sourceFile
    );
  }
}

/**
 * Process a single import declaration
 */
function processImportDeclaration(
  importDecl: ImportDeclaration,
  consumerModule: string,
  registry: ExportRegistry,
  files: Map<string, SourceFile>,
  basePath: string,
  consumers: ConsumerMap,
  sourceFile: SourceFile
): void {
  const moduleSpecifier = importDecl.getModuleSpecifierValue();

  // Only process relative imports
  if (!moduleSpecifier.startsWith('.')) {
    return;
  }

  // Resolve the import path
  const resolvedPath = resolveImportPath(sourceFile, moduleSpecifier);
  if (!resolvedPath) return;

  // Check if the imported module is within our analyzed files
  if (!files.has(resolvedPath)) return;

  const importedModule = path.relative(basePath, resolvedPath);

  // Process default import: import X from './module'
  const defaultImport = importDecl.getDefaultImport();
  if (defaultImport) {
    recordConsumer(importedModule, 'default', consumerModule, registry, files, basePath, consumers);
  }

  // Process named imports: import { X, Y as Z } from './module'
  const namedImports = importDecl.getNamedImports();
  for (const namedImport of namedImports) {
    const importedName = namedImport.getName();
    recordConsumer(
      importedModule,
      importedName,
      consumerModule,
      registry,
      files,
      basePath,
      consumers
    );
  }

  // Process namespace import: import * as M from './module'
  const namespaceImport = importDecl.getNamespaceImport();
  if (namespaceImport) {
    const namespaceName = namespaceImport.getText();
    // Find all usages of M.X in the file
    processNamespaceUsages(
      sourceFile,
      namespaceName,
      importedModule,
      consumerModule,
      registry,
      files,
      basePath,
      consumers
    );
  }
}

/**
 * Resolve an import path to an absolute file path
 */
function resolveImportPath(sourceFile: SourceFile, specifier: string): string | undefined {
  const sourceDir = path.dirname(sourceFile.getFilePath());
  const resolved = path.resolve(sourceDir, specifier);

  const project = sourceFile.getProject();
  const extensions = ['.ts', '.tsx', '/index.ts', '/index.tsx'];

  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (project.getSourceFile(candidate)) {
      return candidate;
    }
  }

  if (project.getSourceFile(resolved)) {
    return resolved;
  }

  return undefined;
}

/**
 * Record a consumer for an export, resolving through re-exports
 */
function recordConsumer(
  importedModule: string,
  exportName: string,
  consumerModule: string,
  registry: ExportRegistry,
  files: Map<string, SourceFile>,
  basePath: string,
  consumers: ConsumerMap
): void {
  // Don't record self-imports
  if (importedModule === consumerModule) return;

  // Resolve to original export
  const resolved = resolveExport(importedModule, exportName, registry, files, basePath);

  if (!resolved) {
    // Couldn't resolve - might be external or missing
    return;
  }

  const key = `${resolved.originalModule}::${resolved.originalName}`;

  if (!consumers.has(key)) {
    consumers.set(key, []);
  }

  const consumer: Consumer = {
    module: consumerModule,
  };

  // If there's a re-export chain, record it (excluding the original module)
  if (resolved.reExportChain.length > 0) {
    // The chain includes the intermediate modules the import went through
    // Filter out the original module and keep only intermediaries
    const intermediaries = resolved.reExportChain.filter((m) => m !== resolved.originalModule);
    if (intermediaries.length > 0) {
      consumer.via = intermediaries;
    }
  }

  consumers.get(key)!.push(consumer);
}

/**
 * Process namespace import usages (import * as M; then M.X)
 */
function processNamespaceUsages(
  sourceFile: SourceFile,
  namespaceName: string,
  importedModule: string,
  consumerModule: string,
  registry: ExportRegistry,
  files: Map<string, SourceFile>,
  basePath: string,
  consumers: ConsumerMap
): void {
  // Find all property access expressions in the file
  const propertyAccesses = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);

  for (const propAccess of propertyAccesses) {
    const expression = propAccess.getExpression();

    // Check if this is accessing our namespace (M.something)
    if (expression.getKind() === SyntaxKind.Identifier) {
      const identifier = expression as Identifier;
      if (identifier.getText() === namespaceName) {
        const propertyName = propAccess.getName();
        recordConsumer(
          importedModule,
          propertyName,
          consumerModule,
          registry,
          files,
          basePath,
          consumers
        );
      }
    }
  }
}

/**
 * Build the final dependency info output
 */
export function buildDependencyOutput(
  registry: ExportRegistry,
  consumers: ConsumerMap,
  files: Map<string, SourceFile>,
  basePath: string
): ExportDependencyInfo[] {
  const output: ExportDependencyInfo[] = [];
  const processedExports = new Set<string>();

  // Process all exports in the registry
  for (const entry of registry.values()) {
    // Skip star export markers
    if (entry.name === '*') continue;

    // Resolve to original to avoid duplicates from re-exports
    const resolved = resolveExport(entry.module, entry.name, registry, files, basePath);
    if (!resolved) continue;

    const originalKey = `${resolved.originalModule}::${resolved.originalName}`;

    // Skip if we've already processed this original export
    if (processedExports.has(originalKey)) continue;
    processedExports.add(originalKey);

    const exportConsumers = consumers.get(originalKey) || [];

    // Deduplicate consumers (same module might import via different paths)
    const uniqueConsumers = deduplicateConsumers(exportConsumers);

    output.push({
      module: resolved.originalModule,
      name: resolved.originalName,
      consumerCount: uniqueConsumers.length,
      consumers: uniqueConsumers,
    });
  }

  // Sort by module path, then by export name
  output.sort((a, b) => {
    const moduleCompare = a.module.localeCompare(b.module);
    if (moduleCompare !== 0) return moduleCompare;
    return a.name.localeCompare(b.name);
  });

  return output;
}

/**
 * Deduplicate consumers, keeping unique module paths
 */
function deduplicateConsumers(consumers: Consumer[]): Consumer[] {
  const seen = new Map<string, Consumer>();

  for (const consumer of consumers) {
    const existing = seen.get(consumer.module);
    if (!existing) {
      seen.set(consumer.module, consumer);
    } else if (consumer.via && !existing.via) {
      // Prefer the one with via information
      seen.set(consumer.module, consumer);
    }
  }

  return Array.from(seen.values()).sort((a, b) => a.module.localeCompare(b.module));
}
