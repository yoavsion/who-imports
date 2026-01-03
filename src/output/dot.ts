import type { ExportDependencyInfo } from '../types.js';

/**
 * Format dependency info as GraphViz DOT format
 */
export function formatAsDot(exports: ExportDependencyInfo[]): string {
  const lines: string[] = [];

  lines.push('digraph ExportDependencies {');
  lines.push('  rankdir=LR;');
  lines.push('  node [shape=box, fontname="Helvetica", fontsize=10];');
  lines.push('  edge [fontname="Helvetica", fontsize=8];');
  lines.push('');

  // Collect exports by module
  const moduleExports = new Map<string, ExportDependencyInfo[]>();
  for (const exp of exports) {
    if (!moduleExports.has(exp.module)) {
      moduleExports.set(exp.module, []);
    }
    moduleExports.get(exp.module)!.push(exp);
  }

  // Collect all consumer modules (including those not in export set)
  const consumerModules = new Set<string>();
  for (const exp of exports) {
    for (const consumer of exp.consumers) {
      if (!moduleExports.has(consumer.module)) {
        consumerModules.add(consumer.module);
      }
    }
  }

  // Output module clusters with their exports
  let clusterIndex = 0;
  for (const [module, moduleExps] of moduleExports) {
    lines.push(`  subgraph cluster_${clusterIndex++} {`);
    lines.push(`    label="${escapeString(module)}";`);
    lines.push('    style=filled;');
    lines.push('    color=lightgrey;');
    lines.push('');

    for (const exp of moduleExps) {
      const nodeId = getExportNodeId(exp.module, exp.name);
      const label = exp.name === 'default' ? '[default]' : exp.name;
      lines.push(`    ${nodeId} [label="${escapeString(label)}"];`);
    }

    lines.push('  }');
    lines.push('');
  }

  // Output standalone consumer modules (not in export set)
  for (const module of consumerModules) {
    const nodeId = getModuleNodeId(module);
    const label = getShortModuleName(module);
    lines.push(
      `  ${nodeId} [label="${escapeString(label)}", style=dashed, tooltip="${escapeString(module)}"];`
    );
  }
  if (consumerModules.size > 0) {
    lines.push('');
  }

  // Output edges (consumer -> export)
  for (const exp of exports) {
    const targetNodeId = getExportNodeId(exp.module, exp.name);

    for (const consumer of exp.consumers) {
      // Use first export from consumer module as the source, or the module node
      const sourceNodeId = moduleExports.has(consumer.module)
        ? getExportNodeId(consumer.module, moduleExports.get(consumer.module)![0].name)
        : getModuleNodeId(consumer.module);

      let edgeLabel = '';
      if (consumer.via && consumer.via.length > 0) {
        edgeLabel = ` [label="via ${escapeString(consumer.via.join(' -> '))}"]`;
      }

      lines.push(`  ${sourceNodeId} -> ${targetNodeId}${edgeLabel};`);
    }
  }

  lines.push('}');

  return lines.join('\n');
}

/**
 * Get node ID for an export
 */
function getExportNodeId(module: string, name: string): string {
  return sanitizeNodeId(`${module}::${name}`);
}

/**
 * Get node ID for a module (consumer-only modules)
 */
function getModuleNodeId(module: string): string {
  return sanitizeNodeId(module);
}

/**
 * Get shortened module name for display (filename only)
 */
function getShortModuleName(module: string): string {
  const parts = module.split('/');
  return parts[parts.length - 1];
}

/**
 * Sanitize a string to be a valid DOT node ID
 */
function sanitizeNodeId(str: string): string {
  return str.replace(/[^a-zA-Z0-9]/g, '_');
}

/**
 * Escape a string for use in DOT labels
 */
function escapeString(str: string): string {
  return str.replace(/"/g, '\\"').replace(/\n/g, '\\n');
}
