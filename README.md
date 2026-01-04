# who-imports

[![npm version](https://img.shields.io/npm/v/who-imports.svg)](https://www.npmjs.com/package/who-imports)
[![Downloads](https://img.shields.io/npm/dm/who-imports.svg)](https://www.npmjs.com/package/who-imports)
[![Build Status](https://github.com/yoavsion/who-imports/workflows/CI/badge.svg)](https://github.com/yoavsion/who-imports/actions)
[![License](https://img.shields.io/npm/l/who-imports.svg)](https://github.com/yoavsion/who-imports/blob/main/LICENSE)

Export-level dependency graph tool for TypeScript codebases. Unlike module-level tools (Madge, Skott), this traces dependencies at individual export granularity.

## Installation

```bash
npm install -g who-imports
```

Or run directly with npx:

```bash
npx who-imports -f ./src -o deps.json
```

## Usage

```bash
who-imports -f <folder> [-f <folder>...] [-c <folder>...] -o <output>
```

### Options

| Flag                           | Description                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `-f, --folder <path>`          | Target folder(s) to analyze exports from. Repeatable.                                |
| `-c, --consumer <path>`        | Folder(s) to search for consumers. Defaults to `-f`. Repeatable.                     |
| `-i, --ignore-extension <ext>` | File patterns to ignore (e.g., `'.test.*'`). Quote globs to prevent shell expansion. |
| `-d, --declarations`           | Include `.d.ts` files (excluded by default).                                         |
| `-o, --output <path>`          | Output file. Extension determines format (`.json` or `.dot`).                        |

### Examples

Analyze exports and consumers within the same folder:

```bash
who-imports -f ./src/features/auth -o auth-deps.json
```

Find consumers of shared types across multiple feature folders:

```bash
who-imports \
  -f ./src/shared/types \
  -c ./src/features/payments \
  -c ./src/features/onboarding \
  -o types-consumers.json
```

## Output Formats

### JSON

```json
{
  "exports": [
    {
      "module": "primitiveTypes.ts",
      "name": "GroupId",
      "consumerCount": 7,
      "consumers": [
        { "module": "helpers/csv/operations.ts", "via": ["types.ts"] },
        { "module": "spreadsheet/types.ts" }
      ]
    }
  ]
}
```

- `module`: Relative path to file where export is originally defined
- `name`: Export name (`default` for default exports)
- `consumerCount`: Number of files importing this export
- `consumers[].module`: Consuming file path
- `consumers[].via`: Re-export chain if consumer imported through barrel files

### DOT (GraphViz)

```bash
who-imports -f ./src -o deps.dot
dot -Tsvg deps.dot -o deps.svg  # Render with GraphViz
```

## Features

- **Re-export tracing**: Follows re-exports to original source
  - `export { X } from './other'`
  - `export * from './other'`
  - `import { X } from './other'; export { X };` (import-then-export)
- **Type exports**: Includes `export type` and `import type`
- **Path resolution**: Paths relative to folder (single) or common ancestor (multiple folders)

## Programmatic API

Use as a library for custom tooling:

```typescript
import {
  parseFiles,
  buildExportRegistry,
  findConsumers,
  buildDependencyOutput,
  formatAsJson,
} from 'who-imports';

const { files, basePath } = parseFiles(['./src']);
const registry = buildExportRegistry(files, basePath);
const consumers = findConsumers(files, registry, basePath);
const output = buildDependencyOutput(registry, consumers, files, basePath);

console.log(formatAsJson(output));
```

### Exported Functions

| Function                  | Description                                            |
| ------------------------- | ------------------------------------------------------ |
| `parseFiles`              | Load TypeScript files into a ts-morph Project          |
| `addFilesToProject`       | Add additional files to existing project               |
| `buildExportRegistry`     | Extract all exports and build re-export map            |
| `resolveExport`           | Trace an export to its original source                 |
| `getAllExportsFromModule` | Get all exports from a module (including star exports) |
| `findConsumers`           | Find all consumers of exports                          |
| `buildDependencyOutput`   | Build final dependency output structure                |
| `formatAsJson`            | Format output as JSON                                  |
| `formatAsDot`             | Format output as GraphViz DOT                          |

### Exported Types

`ExportEntry`, `ResolvedExport`, `Consumer`, `ExportDependencyInfo`, `DependencyGraphOutput`, `ExportRegistry`, `ConsumerMap`

## How It Works

```
CLI args
  → parseFiles()           # Load .ts/.tsx files into ts-morph Project
  → buildExportRegistry()  # Extract exports, build re-export map
  → findConsumers()        # Scan imports, trace through re-exports
  → buildDependencyOutput()# Aggregate into final structure
  → formatAsJson/Dot()     # Serialize
```

## Development

```bash
git clone https://github.com/yoavsion/who-imports.git
cd who-imports
yarn install
yarn build
```

### Scripts

| Script        | Description                     |
| ------------- | ------------------------------- |
| `yarn build`  | Compile TypeScript to `dist/`   |
| `yarn dev`    | Run directly via tsx (no build) |
| `yarn test`   | Run tests                       |
| `yarn lint`   | Run ESLint                      |
| `yarn format` | Format with Prettier            |

### Architecture

```
src/
├── index.ts        # CLI entry point (commander)
├── api.ts          # Programmatic API exports
├── types.ts        # Shared TypeScript types
├── parser.ts       # ts-morph project initialization, file collection
├── exports.ts      # Export extraction, re-export chain resolution
├── consumers.ts    # Import scanning, consumer mapping
└── output/
    ├── json.ts     # JSON formatter
    └── dot.ts      # GraphViz DOT formatter
```

## Contributing

Issues and PRs welcome on [GitHub](https://github.com/yoavsion/who-imports).

## Related Tools

- [ts-morph](https://github.com/dsherret/ts-morph) - TypeScript compiler API wrapper (powers this tool)
- [Madge](https://github.com/pahen/madge) - Module-level dependency graphs
- [Skott](https://github.com/antoine-coulon/skott) - Module-level dependency analysis

## License

MIT
