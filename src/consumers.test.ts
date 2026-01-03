import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parseFiles, addFilesToProject, findCommonAncestor } from './parser.js';
import { buildExportRegistry } from './exports.js';
import { findConsumers, buildDependencyOutput } from './consumers.js';
import type { SourceFile } from 'ts-morph';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesPath = path.join(__dirname, '..', 'test-fixtures');
const exportsPath = path.join(fixturesPath, 'exports');
const consumersPath = path.join(fixturesPath, 'consumers');

describe('findConsumers', () => {
  let files: Map<string, SourceFile>;
  let basePath: string;
  let registry: ReturnType<typeof buildExportRegistry>;

  beforeAll(() => {
    const parsed = parseFiles([fixturesPath]);
    files = parsed.files;
    basePath = parsed.basePath;
    registry = buildExportRegistry(files, basePath);
  });

  it('finds consumers of exports', () => {
    const consumers = findConsumers(files, registry, basePath);

    // consumer.ts imports DEFAULT_VALUE directly from primitives.ts
    const defaultValueConsumers = consumers.get('primitives.ts::DEFAULT_VALUE');
    expect(defaultValueConsumers).toBeDefined();
    expect(defaultValueConsumers?.some((c) => c.module === 'consumer.ts')).toBe(true);
  });

  it('tracks via for imports through re-exports', () => {
    const consumers = findConsumers(files, registry, basePath);

    // consumer.ts imports UserId via barrel.ts
    const userIdConsumers = consumers.get('primitives.ts::UserId');
    expect(userIdConsumers).toBeDefined();
    const consumerEntry = userIdConsumers?.find((c) => c.module === 'consumer.ts');
    expect(consumerEntry?.via).toContain('barrel.ts');
  });

  it('tracks via for import-then-export pattern', () => {
    const consumers = findConsumers(files, registry, basePath);

    // consumer.ts imports GroupId via reexporter.ts
    const groupIdConsumers = consumers.get('primitives.ts::GroupId');
    expect(groupIdConsumers).toBeDefined();
    const consumerEntry = groupIdConsumers?.find((c) => c.module === 'consumer.ts');
    expect(consumerEntry?.via).toContain('reexporter.ts');
  });
});

describe('buildDependencyOutput', () => {
  it('produces correct output structure', () => {
    const parsed = parseFiles([fixturesPath]);
    const { files, basePath } = parsed;
    const registry = buildExportRegistry(files, basePath);
    const consumers = findConsumers(files, registry, basePath);
    const output = buildDependencyOutput(registry, consumers, files, basePath);

    // Should have exports
    expect(output.length).toBeGreaterThan(0);

    // Find UserId export
    const userIdExport = output.find((e) => e.module === 'primitives.ts' && e.name === 'UserId');
    expect(userIdExport).toBeDefined();
    expect(userIdExport?.consumerCount).toBeGreaterThan(0);
    expect(userIdExport?.consumers).toBeInstanceOf(Array);
  });
});

describe('consumer scope (separate export/consumer folders)', () => {
  let exportFiles: Map<string, SourceFile>;
  let consumerFiles: Map<string, SourceFile>;
  let allFiles: Map<string, SourceFile>;
  let basePath: string;
  let registry: ReturnType<typeof buildExportRegistry>;

  beforeAll(() => {
    // Parse export files
    const parsed = parseFiles([exportsPath]);
    exportFiles = parsed.files;

    // Add consumer files to the project
    allFiles = new Map(exportFiles);
    addFilesToProject(parsed.project, allFiles, [consumersPath]);

    // Build consumer files map
    consumerFiles = new Map<string, SourceFile>();
    const resolvedConsumersPath = path.resolve(consumersPath);
    for (const [filePath, sourceFile] of allFiles) {
      if (filePath.startsWith(resolvedConsumersPath + path.sep)) {
        consumerFiles.set(filePath, sourceFile);
      }
    }

    // Compute common base path
    basePath = findCommonAncestor([path.resolve(exportsPath), path.resolve(consumersPath)]);

    // Build registry from export files only
    registry = buildExportRegistry(exportFiles, basePath);
  });

  it('finds consumers from separate consumer folder', () => {
    const consumers = findConsumers(allFiles, registry, basePath, consumerFiles);

    // SharedId is exported from exports/shared.ts and imported by consumers/featureA.ts
    const sharedIdConsumers = consumers.get('exports/shared.ts::SharedId');
    expect(sharedIdConsumers).toBeDefined();
    expect(sharedIdConsumers?.some((c) => c.module === 'consumers/featureA.ts')).toBe(true);
    expect(sharedIdConsumers?.some((c) => c.module === 'consumers/featureB.ts')).toBe(true);
  });

  it('finds all exports consumed from separate folders', () => {
    const consumers = findConsumers(allFiles, registry, basePath, consumerFiles);

    // SHARED_CONSTANT is only imported by featureA
    const constantConsumers = consumers.get('exports/shared.ts::SHARED_CONSTANT');
    expect(constantConsumers).toBeDefined();
    expect(constantConsumers?.length).toBe(1);
    expect(constantConsumers?.[0].module).toBe('consumers/featureA.ts');

    // sharedHelper is only imported by featureA
    const helperConsumers = consumers.get('exports/shared.ts::sharedHelper');
    expect(helperConsumers).toBeDefined();
    expect(helperConsumers?.length).toBe(1);
    expect(helperConsumers?.[0].module).toBe('consumers/featureA.ts');
  });

  it('only scans consumer files when consumerFiles is specified', () => {
    // When we pass consumerFiles, exports/shared.ts should NOT appear as a consumer
    // even though it exists in allFiles
    const consumers = findConsumers(allFiles, registry, basePath, consumerFiles);

    // Check that no consumer is from the exports folder
    for (const consumerList of consumers.values()) {
      for (const consumer of consumerList) {
        expect(consumer.module.startsWith('exports/')).toBe(false);
      }
    }
  });

  it('produces correct dependency output with separate scopes', () => {
    const consumers = findConsumers(allFiles, registry, basePath, consumerFiles);
    const output = buildDependencyOutput(registry, consumers, allFiles, basePath);

    // Find SharedId export
    const sharedIdExport = output.find(
      (e) => e.module === 'exports/shared.ts' && e.name === 'SharedId'
    );
    expect(sharedIdExport).toBeDefined();
    expect(sharedIdExport?.consumerCount).toBe(2); // featureA and featureB
  });
});
