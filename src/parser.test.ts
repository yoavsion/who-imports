import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parseFiles, isWithinFolders } from './parser.js';

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
