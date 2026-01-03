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

| Flag                    | Description                                                      |
| ----------------------- | ---------------------------------------------------------------- |
| `-f, --folder <path>`   | Target folder(s) to analyze exports from. Repeatable.            |
| `-c, --consumer <path>` | Folder(s) to search for consumers. Defaults to `-f`. Repeatable. |
| `-o, --output <path>`   | Output file. Extension determines format (`.json` or `.dot`).    |

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
npm install
npm run build
```

### Scripts

| Script           | Description                     |
| ---------------- | ------------------------------- |
| `npm run build`  | Compile TypeScript to `dist/`   |
| `npm run dev`    | Run directly via tsx (no build) |
| `npm test`       | Run tests                       |
| `npm run lint`   | Run ESLint                      |
| `npm run format` | Format with Prettier            |

### Architecture

```
src/
├── index.ts        # CLI entry point (commander)
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
