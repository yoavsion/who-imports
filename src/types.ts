/**
 * Information about a resolved export - where it's originally defined
 */
export interface ResolvedExport {
  /** The module where this export is originally defined */
  originalModule: string;
  /** The name of the export at its original source */
  originalName: string;
  /** Chain of intermediary modules if accessed via re-exports */
  reExportChain: string[];
}

/**
 * Registry entry for an export from a module
 */
export interface ExportEntry {
  /** Module path where the export is declared */
  module: string;
  /** Name of the export */
  name: string;
  /** True if this is a re-export from another module */
  isReExport: boolean;
  /** If re-export, the source module */
  sourceModule?: string;
  /** If re-export with rename, the original name */
  sourceName?: string;
}

/**
 * A consumer of an export
 */
export interface Consumer {
  /** Module path of the consumer */
  module: string;
  /** Chain of re-export modules the import went through (if any) */
  via?: string[];
}

/**
 * Output format for a single export's dependency info
 */
export interface ExportDependencyInfo {
  /** Module path (relative) */
  module: string;
  /** Export name */
  name: string;
  /** Number of consumers */
  consumerCount: number;
  /** List of consumers */
  consumers: Consumer[];
}

/**
 * Full output structure
 */
export interface DependencyGraphOutput {
  exports: ExportDependencyInfo[];
}

/**
 * CLI options
 */
export interface CliOptions {
  folders: string[];
  output: string;
}
