import { Project, SourceFile } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Initialize a ts-morph project and load all TypeScript files from specified folders
 */
export function parseFiles(folders: string[]): {
  project: Project;
  files: Map<string, SourceFile>;
  basePath: string;
} {
  // Resolve all folders to absolute paths
  const resolvedFolders = folders.map((f) => path.resolve(f));

  // Compute base path (common ancestor)
  const basePath =
    resolvedFolders.length === 1 ? resolvedFolders[0] : findCommonAncestor(resolvedFolders);

  // Create project without tsconfig to avoid compilation issues
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      allowJs: true,
      checkJs: false,
      noEmit: true,
    },
  });

  // Collect all .ts/.tsx files from folders
  const filePaths: string[] = [];
  for (const folder of resolvedFolders) {
    collectTypeScriptFiles(folder, filePaths);
  }

  // Add files to project
  for (const filePath of filePaths) {
    project.addSourceFileAtPath(filePath);
  }

  // Build file map
  const files = new Map<string, SourceFile>();
  for (const sourceFile of project.getSourceFiles()) {
    files.set(sourceFile.getFilePath(), sourceFile);
  }

  return { project, files, basePath };
}

/**
 * Add files from additional folders to an existing project
 */
export function addFilesToProject(
  project: Project,
  files: Map<string, SourceFile>,
  folders: string[]
): void {
  const resolvedFolders = folders.map((f) => path.resolve(f));

  // Collect all .ts/.tsx files from folders
  const filePaths: string[] = [];
  for (const folder of resolvedFolders) {
    collectTypeScriptFiles(folder, filePaths);
  }

  // Add files to project (skips already added)
  for (const filePath of filePaths) {
    if (!files.has(filePath)) {
      const sourceFile = project.addSourceFileAtPath(filePath);
      files.set(filePath, sourceFile);
    }
  }
}

/**
 * Recursively collect all .ts and .tsx files from a directory
 */
export function collectTypeScriptFiles(dir: string, result: string[]): void {
  if (!fs.existsSync(dir)) {
    console.warn(`Warning: Directory not found: ${dir}`);
    return;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules and hidden directories
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
        continue;
      }
      collectTypeScriptFiles(fullPath, result);
    } else if (entry.isFile()) {
      if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        result.push(fullPath);
      }
    }
  }
}

/**
 * Find the common ancestor directory of multiple paths
 */
export function findCommonAncestor(paths: string[]): string {
  if (paths.length === 0) return '/';
  if (paths.length === 1) return paths[0];

  const parts = paths.map((p) => p.split(path.sep));
  const minLength = Math.min(...parts.map((p) => p.length));

  const commonParts: string[] = [];
  for (let i = 0; i < minLength; i++) {
    const segment = parts[0][i];
    if (parts.every((p) => p[i] === segment)) {
      commonParts.push(segment);
    } else {
      break;
    }
  }

  return commonParts.join(path.sep) || '/';
}

/**
 * Check if a file path is within any of the specified folders
 */
export function isWithinFolders(filePath: string, folders: string[]): boolean {
  const resolved = path.resolve(filePath);
  return folders.some((folder) => {
    const resolvedFolder = path.resolve(folder);
    return resolved.startsWith(resolvedFolder + path.sep) || resolved === resolvedFolder;
  });
}
