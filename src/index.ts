#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import type { SourceFile } from 'ts-morph';
import { parseFiles, addFilesToProject, findCommonAncestor } from './parser.js';
import { buildExportRegistry } from './exports.js';
import { findConsumers, buildDependencyOutput } from './consumers.js';
import { formatAsJson } from './output/json.js';
import { formatAsDot } from './output/dot.js';

const program = new Command();

program
  .name('who-imports')
  .description('Generate export-level dependency graphs for TypeScript codebases')
  .version('0.2.0')
  .requiredOption('-f, --folder <paths...>', 'Target folder(s) to analyze exports from')
  .option('-c, --consumer <paths...>', 'Folder(s) to search for consumers (defaults to --folder)')
  .option('-i, --ignore-extension <exts...>', 'File extensions to ignore (e.g., .test.ts .spec.ts)')
  .option('-d, --declarations', 'Include .d.ts declaration files (excluded by default)', false)
  .requiredOption('-o, --output <path>', 'Output file path (.json or .dot)')
  .parse(process.argv);

const options = program.opts<{
  folder: string[];
  consumer?: string[];
  ignoreExtension?: string[];
  declarations: boolean;
  output: string;
}>();

function validateFolders(folders: string[], label: string): void {
  for (const folder of folders) {
    const resolved = path.resolve(folder);
    if (!fs.existsSync(resolved)) {
      console.error(`Error: ${label} folder not found: ${folder}`);
      process.exit(1);
    }
    if (!fs.statSync(resolved).isDirectory()) {
      console.error(`Error: ${label} path is not a directory: ${folder}`);
      process.exit(1);
    }
  }
}

async function main() {
  const {
    folder: exportFolders,
    consumer: consumerFolders,
    ignoreExtension,
    declarations,
    output,
  } = options;

  // Build ignore extensions list (always ignore .d.ts unless --declarations is set)
  const ignoreExtensions = [...(ignoreExtension ?? [])];
  if (!declarations) {
    ignoreExtensions.push('.d.ts');
  }

  // Default consumer folders to export folders
  const effectiveConsumerFolders = consumerFolders ?? exportFolders;

  // Validate folders exist
  validateFolders(exportFolders, 'Export');
  if (consumerFolders) {
    validateFolders(consumerFolders, 'Consumer');
  }

  // Determine output format from extension
  const outputExt = path.extname(output).toLowerCase();
  if (outputExt !== '.json' && outputExt !== '.dot') {
    console.error('Error: Output file must have .json or .dot extension');
    process.exit(1);
  }

  console.log(`Export folders: ${exportFolders.join(', ')}`);
  console.log(`Consumer folders: ${effectiveConsumerFolders.join(', ')}`);

  // Parse export files
  console.log('Parsing TypeScript files...');
  const {
    project,
    files: exportFiles,
    basePath: exportBasePath,
  } = parseFiles(exportFolders, ignoreExtensions);
  console.log(`Found ${exportFiles.size} export files`);

  if (exportFiles.size === 0) {
    console.error('Error: No TypeScript files found in export folders');
    process.exit(1);
  }

  // If consumer folders differ, add those files too
  let consumerFiles: Map<string, SourceFile> | undefined;
  let basePath = exportBasePath;

  if (consumerFolders && consumerFolders.length > 0) {
    // Add consumer files to project
    const allFiles = new Map(exportFiles);
    addFilesToProject(project, allFiles, effectiveConsumerFolders, ignoreExtensions);

    // Build consumer files map (only files in consumer folders)
    consumerFiles = new Map<string, SourceFile>();
    const resolvedConsumerFolders = effectiveConsumerFolders.map((f) => path.resolve(f));
    for (const [filePath, sourceFile] of allFiles) {
      if (resolvedConsumerFolders.some((folder) => filePath.startsWith(folder + path.sep))) {
        consumerFiles.set(filePath, sourceFile);
      }
    }

    // Recompute base path to include both export and consumer folders
    const allFolders = [...exportFolders, ...effectiveConsumerFolders].map((f) => path.resolve(f));
    basePath = findCommonAncestor(allFolders);

    console.log(`Found ${consumerFiles.size} consumer files`);
  }

  // Build export registry from export files only
  console.log('Extracting exports...');
  const registry = buildExportRegistry(exportFiles, basePath);
  console.log(`Found ${registry.size} exports`);

  // Find consumers
  console.log('Finding consumers...');
  const allFiles = consumerFiles ? new Map([...exportFiles, ...consumerFiles]) : exportFiles;
  const consumers = findConsumers(allFiles, registry, basePath, consumerFiles);

  // Build output
  console.log('Building dependency graph...');
  const dependencyInfo = buildDependencyOutput(registry, consumers, allFiles, basePath);

  // Format and write output
  let outputContent: string;
  if (outputExt === '.json') {
    outputContent = formatAsJson(dependencyInfo);
  } else {
    outputContent = formatAsDot(dependencyInfo);
  }

  // Ensure output directory exists
  const outputDir = path.dirname(path.resolve(output));
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(output, outputContent);
  console.log(`Output written to: ${output}`);

  // Print summary
  const totalConsumers = dependencyInfo.reduce((sum, exp) => sum + exp.consumerCount, 0);
  console.log(`\nSummary:`);
  console.log(`  Exports: ${dependencyInfo.length}`);
  console.log(`  Total consumer relationships: ${totalConsumers}`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
