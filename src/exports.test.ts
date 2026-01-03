import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parseFiles } from './parser.js';
import { buildExportRegistry, resolveExport } from './exports.js';
import type { SourceFile } from 'ts-morph';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesPath = path.join(__dirname, '..', 'test-fixtures');

describe('buildExportRegistry', () => {
  let files: Map<string, SourceFile>;
  let basePath: string;
  let registry: ReturnType<typeof buildExportRegistry>;

  beforeAll(() => {
    const parsed = parseFiles([fixturesPath]);
    files = parsed.files;
    basePath = parsed.basePath;
    registry = buildExportRegistry(files, basePath);
  });

  it('finds direct exports from primitives.ts', () => {
    expect(registry.has('primitives.ts::UserId')).toBe(true);
    expect(registry.has('primitives.ts::GroupId')).toBe(true);
    expect(registry.has('primitives.ts::DEFAULT_VALUE')).toBe(true);
    expect(registry.has('primitives.ts::helper')).toBe(true);
    expect(registry.has('primitives.ts::default')).toBe(true);
  });

  it('marks direct exports as non-re-exports', () => {
    const entry = registry.get('primitives.ts::UserId');
    expect(entry?.isReExport).toBe(false);
  });

  it('detects re-exports via export { } from syntax', () => {
    const entry = registry.get('barrel.ts::UserId');
    expect(entry?.isReExport).toBe(true);
    expect(entry?.sourceName).toBe('UserId');
  });

  it('detects renamed re-exports', () => {
    const entry = registry.get('barrel.ts::utilHelper');
    expect(entry?.isReExport).toBe(true);
    expect(entry?.sourceName).toBe('helper');
  });

  it('detects import-then-export pattern', () => {
    const entry = registry.get('reexporter.ts::GroupId');
    expect(entry?.isReExport).toBe(true);
  });

  it('detects import-then-export with rename', () => {
    const entry = registry.get('reexporter.ts::REEXPORTED_VALUE');
    expect(entry?.isReExport).toBe(true);
    expect(entry?.sourceName).toBe('DEFAULT_VALUE');
  });

  it('detects star re-exports', () => {
    const entry = registry.get('starBarrel.ts::*');
    expect(entry?.isReExport).toBe(true);
  });
});

describe('resolveExport', () => {
  let files: Map<string, SourceFile>;
  let basePath: string;
  let registry: ReturnType<typeof buildExportRegistry>;

  beforeAll(() => {
    const parsed = parseFiles([fixturesPath]);
    files = parsed.files;
    basePath = parsed.basePath;
    registry = buildExportRegistry(files, basePath);
  });

  it('resolves direct export to itself', () => {
    const resolved = resolveExport('primitives.ts', 'UserId', registry, files, basePath);
    expect(resolved?.originalModule).toBe('primitives.ts');
    expect(resolved?.originalName).toBe('UserId');
    expect(resolved?.reExportChain).toEqual([]);
  });

  it('resolves re-export to original source', () => {
    const resolved = resolveExport('barrel.ts', 'UserId', registry, files, basePath);
    expect(resolved?.originalModule).toBe('primitives.ts');
    expect(resolved?.originalName).toBe('UserId');
    expect(resolved?.reExportChain).toEqual(['barrel.ts']);
  });

  it('resolves renamed re-export to original', () => {
    const resolved = resolveExport('barrel.ts', 'utilHelper', registry, files, basePath);
    expect(resolved?.originalModule).toBe('primitives.ts');
    expect(resolved?.originalName).toBe('helper');
  });

  it('resolves import-then-export to original', () => {
    const resolved = resolveExport('reexporter.ts', 'GroupId', registry, files, basePath);
    expect(resolved?.originalModule).toBe('primitives.ts');
    expect(resolved?.originalName).toBe('GroupId');
    expect(resolved?.reExportChain).toEqual(['reexporter.ts']);
  });

  it('resolves through star exports', () => {
    const resolved = resolveExport('starBarrel.ts', 'UserId', registry, files, basePath);
    expect(resolved?.originalModule).toBe('primitives.ts');
    expect(resolved?.originalName).toBe('UserId');
    expect(resolved?.reExportChain).toEqual(['starBarrel.ts']);
  });
});
