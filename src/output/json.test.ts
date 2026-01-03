import { describe, it, expect } from 'vitest';
import { formatAsJson } from './json.js';
import type { ExportDependencyInfo } from '../types.js';

describe('formatAsJson', () => {
  it('returns valid JSON', () => {
    const exports: ExportDependencyInfo[] = [];
    const result = formatAsJson(exports);
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('wraps exports in an object with exports key', () => {
    const exports: ExportDependencyInfo[] = [];
    const result = JSON.parse(formatAsJson(exports));
    expect(result).toHaveProperty('exports');
    expect(Array.isArray(result.exports)).toBe(true);
  });

  it('includes all export properties', () => {
    const exports: ExportDependencyInfo[] = [
      {
        module: 'test.ts',
        name: 'TestExport',
        consumerCount: 2,
        consumers: [{ module: 'consumer1.ts' }, { module: 'consumer2.ts', via: ['barrel.ts'] }],
      },
    ];

    const result = JSON.parse(formatAsJson(exports));
    const exp = result.exports[0];

    expect(exp.module).toBe('test.ts');
    expect(exp.name).toBe('TestExport');
    expect(exp.consumerCount).toBe(2);
    expect(exp.consumers).toHaveLength(2);
  });

  it('preserves via arrays', () => {
    const exports: ExportDependencyInfo[] = [
      {
        module: 'original.ts',
        name: 'Foo',
        consumerCount: 1,
        consumers: [{ module: 'consumer.ts', via: ['barrel1.ts', 'barrel2.ts'] }],
      },
    ];

    const result = JSON.parse(formatAsJson(exports));
    const consumer = result.exports[0].consumers[0];

    expect(consumer.via).toEqual(['barrel1.ts', 'barrel2.ts']);
  });

  it('formats with indentation', () => {
    const exports: ExportDependencyInfo[] = [
      { module: 'a.ts', name: 'A', consumerCount: 0, consumers: [] },
    ];

    const result = formatAsJson(exports);
    expect(result).toContain('\n');
    expect(result).toContain('  '); // 2-space indent
  });
});
