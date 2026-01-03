import { SourceFile, ExportDeclaration } from 'ts-morph';
import * as path from 'path';
import type { ExportEntry, ResolvedExport } from './types.js';

/**
 * Registry of all exports across analyzed files
 * Key: "modulePath::exportName"
 */
export type ExportRegistry = Map<string, ExportEntry>;

/**
 * Build an export registry from all source files
 */
export function buildExportRegistry(
  files: Map<string, SourceFile>,
  basePath: string
): ExportRegistry {
  const registry: ExportRegistry = new Map();

  for (const [filePath, sourceFile] of files) {
    const relativePath = path.relative(basePath, filePath);
    extractExportsFromFile(sourceFile, relativePath, registry);
  }

  return registry;
}

/**
 * Build a map of imported symbols to their source modules
 * Returns: Map<localName, { sourceModule: string, sourceName: string }>
 */
function buildImportMap(
  sourceFile: SourceFile
): Map<string, { sourceModule: string | undefined; sourceName: string }> {
  const importMap = new Map<string, { sourceModule: string | undefined; sourceName: string }>();

  for (const importDecl of sourceFile.getImportDeclarations()) {
    const moduleSpecifier = importDecl.getModuleSpecifierValue();
    const resolvedPath = resolveModulePath(sourceFile, moduleSpecifier);

    // Default import: import X from './module'
    const defaultImport = importDecl.getDefaultImport();
    if (defaultImport) {
      importMap.set(defaultImport.getText(), {
        sourceModule: resolvedPath,
        sourceName: 'default',
      });
    }

    // Named imports: import { X, Y as Z } from './module'
    // For `import { X as Y }`, getName() = 'X', getAliasNode()?.getText() = 'Y'
    for (const namedImport of importDecl.getNamedImports()) {
      const localName = namedImport.getAliasNode()?.getText() || namedImport.getName();
      const sourceName = namedImport.getName();

      importMap.set(localName, {
        sourceModule: resolvedPath,
        sourceName,
      });
    }

    // Namespace import: import * as M from './module'
    const namespaceImport = importDecl.getNamespaceImport();
    if (namespaceImport) {
      importMap.set(namespaceImport.getText(), {
        sourceModule: resolvedPath,
        sourceName: '*',
      });
    }
  }

  return importMap;
}

/**
 * Extract all exports from a single source file
 */
function extractExportsFromFile(
  sourceFile: SourceFile,
  modulePath: string,
  registry: ExportRegistry
): void {
  // First, build a map of imports to detect import-then-export patterns
  const importMap = buildImportMap(sourceFile);

  // Handle named exports: export { X }, export { X as Y }
  // Handle re-exports: export { X } from './other', export * from './other'
  for (const exportDecl of sourceFile.getExportDeclarations()) {
    processExportDeclaration(exportDecl, modulePath, registry, sourceFile, importMap);
  }

  // Handle export assignments: export default X, export = X
  if (sourceFile.getExportAssignments().length > 0) {
    registerDefaultExport(modulePath, registry);
  }

  // Handle inline exports: export const X, export function Y, export class Z
  // Also handles: export type X, export interface Y
  for (const [name, declarations] of sourceFile.getExportedDeclarations()) {
    // Skip if already processed as re-export
    const key = `${modulePath}::${name}`;
    if (registry.has(key)) continue;

    // Check if this is a local declaration (not a re-export)
    const isLocal = declarations.some((decl) => {
      const declSourceFile = decl.getSourceFile();
      return declSourceFile.getFilePath() === sourceFile.getFilePath();
    });

    if (isLocal) {
      registry.set(key, {
        module: modulePath,
        name,
        isReExport: false,
      });
    }
  }
}

/**
 * Process an export declaration (named exports and re-exports)
 */
function processExportDeclaration(
  exportDecl: ExportDeclaration,
  modulePath: string,
  registry: ExportRegistry,
  sourceFile: SourceFile,
  importMap: Map<string, { sourceModule: string | undefined; sourceName: string }>
): void {
  const moduleSpecifier = exportDecl.getModuleSpecifierValue();

  // export * from './other'
  if (exportDecl.isNamespaceExport() && moduleSpecifier) {
    const resolvedPath = resolveModulePath(sourceFile, moduleSpecifier);
    if (resolvedPath) {
      // Star exports are handled specially - we need to enumerate at resolution time
      const key = `${modulePath}::*`;
      registry.set(key, {
        module: modulePath,
        name: '*',
        isReExport: true,
        sourceModule: resolvedPath,
      });
    }
    return;
  }

  // export { X, Y as Z } or export { X, Y as Z } from './other'
  for (const namedExport of exportDecl.getNamedExports()) {
    const exportedName = namedExport.getName();
    const localName = namedExport.getAliasNode()?.getText() || exportedName;
    const key = `${modulePath}::${localName}`;

    if (moduleSpecifier) {
      // Re-export from another module: export { X } from './other'
      const resolvedPath = resolveModulePath(sourceFile, moduleSpecifier);
      registry.set(key, {
        module: modulePath,
        name: localName,
        isReExport: true,
        sourceModule: resolvedPath || moduleSpecifier,
        sourceName: exportedName,
      });
    } else {
      // export { X } without from - check if X was imported
      const importInfo = importMap.get(exportedName);
      if (importInfo && importInfo.sourceModule) {
        // This is an import-then-export pattern (re-export)
        registry.set(key, {
          module: modulePath,
          name: localName,
          isReExport: true,
          sourceModule: importInfo.sourceModule,
          sourceName: importInfo.sourceName,
        });
      } else {
        // Truly local export
        registry.set(key, {
          module: modulePath,
          name: localName,
          isReExport: false,
        });
      }
    }
  }
}

/**
 * Register a default export for a module
 */
function registerDefaultExport(modulePath: string, registry: ExportRegistry): void {
  const key = `${modulePath}::default`;
  if (!registry.has(key)) {
    registry.set(key, {
      module: modulePath,
      name: 'default',
      isReExport: false,
    });
  }
}

/**
 * Resolve a module specifier to a relative path
 */
function resolveModulePath(sourceFile: SourceFile, specifier: string): string | undefined {
  // Only resolve relative imports
  if (!specifier.startsWith('.')) {
    return undefined; // External module
  }

  const sourceDir = path.dirname(sourceFile.getFilePath());
  const resolved = path.resolve(sourceDir, specifier);

  // Try to find the actual file with extensions
  const project = sourceFile.getProject();
  const extensions = ['.ts', '.tsx', '/index.ts', '/index.tsx'];

  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (project.getSourceFile(candidate)) {
      return candidate;
    }
  }

  // Check if it already has an extension
  if (project.getSourceFile(resolved)) {
    return resolved;
  }

  return undefined;
}

/**
 * Resolve an export to its original source, following re-export chains
 */
export function resolveExport(
  modulePath: string,
  exportName: string,
  registry: ExportRegistry,
  files: Map<string, SourceFile>,
  basePath: string,
  visited: Set<string> = new Set()
): ResolvedExport | undefined {
  const key = `${modulePath}::${exportName}`;

  // Cycle detection
  if (visited.has(key)) {
    return undefined;
  }
  visited.add(key);

  const entry = registry.get(key);

  // If not in registry, check for star exports in the module
  if (!entry) {
    return resolveFromStarExports(modulePath, exportName, registry, files, basePath, visited);
  }

  // If it's a direct export, return it
  if (!entry.isReExport) {
    return {
      originalModule: modulePath,
      originalName: exportName,
      reExportChain: [],
    };
  }

  // It's a re-export - follow the chain
  if (entry.sourceModule) {
    const sourceRelative = path.relative(basePath, entry.sourceModule);
    const sourceName = entry.sourceName || exportName;

    const resolved = resolveExport(sourceRelative, sourceName, registry, files, basePath, visited);

    if (resolved) {
      return {
        ...resolved,
        reExportChain: [modulePath, ...resolved.reExportChain],
      };
    }
  }

  return undefined;
}

/**
 * Try to resolve an export through star re-exports
 */
function resolveFromStarExports(
  modulePath: string,
  exportName: string,
  registry: ExportRegistry,
  files: Map<string, SourceFile>,
  basePath: string,
  visited: Set<string>
): ResolvedExport | undefined {
  // Look for star exports in this module
  const starKey = `${modulePath}::*`;
  const starEntry = registry.get(starKey);

  if (starEntry && starEntry.sourceModule) {
    const sourceRelative = path.relative(basePath, starEntry.sourceModule);
    const resolved = resolveExport(sourceRelative, exportName, registry, files, basePath, visited);

    if (resolved) {
      return {
        ...resolved,
        reExportChain: [modulePath, ...resolved.reExportChain],
      };
    }
  }

  return undefined;
}

/**
 * Get all exports from a module (including those from star exports)
 */
export function getAllExportsFromModule(
  modulePath: string,
  registry: ExportRegistry,
  files: Map<string, SourceFile>,
  basePath: string,
  visited: Set<string> = new Set()
): Map<string, ResolvedExport> {
  const result = new Map<string, ResolvedExport>();

  if (visited.has(modulePath)) {
    return result;
  }
  visited.add(modulePath);

  // Get direct exports
  for (const [key] of registry) {
    if (!key.startsWith(modulePath + '::')) continue;
    const exportName = key.split('::')[1];

    if (exportName === '*') continue; // Skip star export markers

    const resolved = resolveExport(modulePath, exportName, registry, files, basePath);
    if (resolved) {
      result.set(exportName, resolved);
    }
  }

  // Get star exports
  const starKey = `${modulePath}::*`;
  const starEntry = registry.get(starKey);
  if (starEntry && starEntry.sourceModule) {
    const sourceRelative = path.relative(basePath, starEntry.sourceModule);
    const starExports = getAllExportsFromModule(sourceRelative, registry, files, basePath, visited);

    for (const [name, resolved] of starExports) {
      if (!result.has(name)) {
        result.set(name, {
          ...resolved,
          reExportChain: [modulePath, ...resolved.reExportChain],
        });
      }
    }
  }

  return result;
}
