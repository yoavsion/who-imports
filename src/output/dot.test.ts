import { describe, it, expect } from 'vitest';
import { formatAsDot } from './dot.js';
import type { ExportDependencyInfo } from '../types.js';

describe('formatAsDot', () => {
  it('starts with digraph declaration', () => {
    const exports: ExportDependencyInfo[] = [];
    const result = formatAsDot(exports);
    expect(result).toMatch(/^digraph ExportDependencies \{/);
  });

  it('ends with closing brace', () => {
    const exports: ExportDependencyInfo[] = [];
    const result = formatAsDot(exports);
    expect(result.trim()).toMatch(/\}$/);
  });

  it('includes rankdir setting', () => {
    const exports: ExportDependencyInfo[] = [];
    const result = formatAsDot(exports);
    expect(result).toContain('rankdir=LR');
  });

  it('creates subgraph clusters for modules', () => {
    const exports: ExportDependencyInfo[] = [
      { module: 'test.ts', name: 'Foo', consumerCount: 0, consumers: [] },
    ];

    const result = formatAsDot(exports);
    expect(result).toContain('subgraph cluster_');
    expect(result).toContain('label="test.ts"');
  });

  it('creates nodes for exports', () => {
    const exports: ExportDependencyInfo[] = [
      { module: 'test.ts', name: 'MyExport', consumerCount: 0, consumers: [] },
    ];

    const result = formatAsDot(exports);
    expect(result).toContain('label="MyExport"');
  });

  it('labels default exports correctly', () => {
    const exports: ExportDependencyInfo[] = [
      { module: 'test.ts', name: 'default', consumerCount: 0, consumers: [] },
    ];

    const result = formatAsDot(exports);
    expect(result).toContain('label="[default]"');
  });

  it('creates edges for consumer relationships', () => {
    const exports: ExportDependencyInfo[] = [
      {
        module: 'source.ts',
        name: 'Foo',
        consumerCount: 1,
        consumers: [{ module: 'consumer.ts' }],
      },
    ];

    const result = formatAsDot(exports);
    expect(result).toContain('->');
  });

  it('includes via label on edges when present', () => {
    const exports: ExportDependencyInfo[] = [
      {
        module: 'source.ts',
        name: 'Foo',
        consumerCount: 1,
        consumers: [{ module: 'consumer.ts', via: ['barrel.ts'] }],
      },
    ];

    const result = formatAsDot(exports);
    expect(result).toContain('via');
    expect(result).toContain('barrel.ts');
  });

  it('escapes special characters in labels', () => {
    const exports: ExportDependencyInfo[] = [
      { module: 'path/to/file.ts', name: 'Test', consumerCount: 0, consumers: [] },
    ];

    const result = formatAsDot(exports);
    // Should not break DOT syntax
    expect(result).toContain('path/to/file.ts');
  });

  it('handles multiple modules', () => {
    const exports: ExportDependencyInfo[] = [
      { module: 'a.ts', name: 'A', consumerCount: 0, consumers: [] },
      { module: 'b.ts', name: 'B', consumerCount: 0, consumers: [] },
    ];

    const result = formatAsDot(exports);
    expect(result).toContain('label="a.ts"');
    expect(result).toContain('label="b.ts"');
  });
});
