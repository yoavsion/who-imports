import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parseFiles, isWithinFolders, findCommonAncestor } from './parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesPath = path.join(__dirname, '..', 'test-fixtures');

describe('parseFiles', () => {
  it('parses TypeScript files from a folder', () => {
    const { files } = parseFiles([fixturesPath]);
    expect(files.size).toBeGreaterThan(0);
  });

  it('returns absolute file paths as keys', () => {
    const { files } = parseFiles([fixturesPath]);
    for (const filePath of files.keys()) {
      expect(path.isAbsolute(filePath)).toBe(true);
    }
  });

  it('sets basePath to the folder when single folder provided', () => {
    const { basePath } = parseFiles([fixturesPath]);
    expect(basePath).toBe(fixturesPath);
  });

  it('finds common ancestor for multiple folders', () => {
    // When given the same folder twice, basePath should still be that folder
    const { basePath } = parseFiles([fixturesPath, fixturesPath]);
    expect(basePath).toBe(fixturesPath);
  });

  it('includes .ts files', () => {
    const { files } = parseFiles([fixturesPath]);
    const filePaths = Array.from(files.keys());
    expect(filePaths.some((f) => f.endsWith('.ts'))).toBe(true);
  });

  it('creates a ts-morph Project', () => {
    const { project } = parseFiles([fixturesPath]);
    expect(project).toBeDefined();
    expect(project.getSourceFiles().length).toBeGreaterThan(0);
  });
});

describe('parseFiles with ignoreExtensions', () => {
  it('ignores files with exact extension match', () => {
    const { files } = parseFiles([fixturesPath], ['.test.ts']);
    const filePaths = Array.from(files.keys());
    expect(filePaths.some((f) => f.endsWith('.test.ts'))).toBe(false);
  });

  it('ignores files with glob pattern', () => {
    const { files } = parseFiles([fixturesPath], ['.spec.*']);
    const filePaths = Array.from(files.keys());
    expect(filePaths.some((f) => f.includes('.spec.'))).toBe(false);
  });

  it('ignores .d.ts files when specified', () => {
    const { files } = parseFiles([fixturesPath], ['.d.ts']);
    const filePaths = Array.from(files.keys());
    expect(filePaths.some((f) => f.endsWith('.d.ts'))).toBe(false);
  });

  it('includes .d.ts files when not ignored', () => {
    const { files } = parseFiles([fixturesPath], []);
    const filePaths = Array.from(files.keys());
    expect(filePaths.some((f) => f.endsWith('.d.ts'))).toBe(true);
  });

  it('supports multiple ignore patterns', () => {
    const { files } = parseFiles([fixturesPath], ['.test.ts', '.spec.ts']);
    const filePaths = Array.from(files.keys());
    expect(filePaths.some((f) => f.endsWith('.test.ts'))).toBe(false);
    expect(filePaths.some((f) => f.endsWith('.spec.ts'))).toBe(false);
  });
});

describe('parseFiles with JS/JSX support', () => {
  it('includes .js files', () => {
    const { files } = parseFiles([fixturesPath]);
    const filePaths = Array.from(files.keys());
    expect(filePaths.some((f) => f.endsWith('.js'))).toBe(true);
  });

  it('includes .jsx files', () => {
    const { files } = parseFiles([fixturesPath]);
    const filePaths = Array.from(files.keys());
    expect(filePaths.some((f) => f.endsWith('.jsx'))).toBe(true);
  });
});

describe('isWithinFolders', () => {
  it('returns true for files within the folder', () => {
    const folder = '/project/src';
    expect(isWithinFolders('/project/src/file.ts', [folder])).toBe(true);
    expect(isWithinFolders('/project/src/nested/file.ts', [folder])).toBe(true);
  });

  it('returns false for files outside the folder', () => {
    const folder = '/project/src';
    expect(isWithinFolders('/project/other/file.ts', [folder])).toBe(false);
    expect(isWithinFolders('/other/src/file.ts', [folder])).toBe(false);
  });

  it('handles multiple folders', () => {
    const folders = ['/project/src', '/project/lib'];
    expect(isWithinFolders('/project/src/file.ts', folders)).toBe(true);
    expect(isWithinFolders('/project/lib/file.ts', folders)).toBe(true);
    expect(isWithinFolders('/project/other/file.ts', folders)).toBe(false);
  });
});

describe('findCommonAncestor', () => {
  it('returns the path for a single folder', () => {
    expect(findCommonAncestor(['/project/src'])).toBe('/project/src');
  });

  it('returns root for empty array', () => {
    expect(findCommonAncestor([])).toBe('/');
  });

  it('finds common ancestor for sibling folders', () => {
    expect(findCommonAncestor(['/project/src', '/project/lib'])).toBe('/project');
  });

  it('finds common ancestor for nested folders', () => {
    expect(findCommonAncestor(['/project/src/features', '/project/src/utils'])).toBe(
      '/project/src'
    );
  });

  it('finds common ancestor for deeply nested folders', () => {
    expect(findCommonAncestor(['/a/b/c/d', '/a/b/x/y'])).toBe('/a/b');
  });

  it('handles folders with no common ancestor beyond root', () => {
    expect(findCommonAncestor(['/project/src', '/other/lib'])).toBe('/');
  });

  it('handles three or more folders', () => {
    expect(findCommonAncestor(['/project/src', '/project/lib', '/project/test'])).toBe('/project');
  });
});
