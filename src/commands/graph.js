'use strict';

const chalk = require('chalk');
const path = require('path');
const { loadGraph, saveGraph } = require('../lib/graph');
const { readIndex } = require('../lib/index');
const { requireInit } = require('../lib/guard');

function graph(filepath, options) {
  requireInit();
  const projectRoot = process.cwd();

  try {
    let g = loadGraph();

    // Rebuild graph if requested or it's empty
    if (options.build || (Object.keys(g.imports).length === 0 && filepath)) {
      console.log(chalk.cyan('📖 Building dependency graph...'));
      const { buildFullGraph } = require('../watcher/graph');
      g = buildFullGraph(projectRoot);
      saveGraph(g);
      console.log(chalk.green(`✓ Graph built: ${Object.keys(g.imports).length} files indexed`));
      if (!filepath) return;
    }

    if (!filepath) {
      // Stats overview
      const fileCount = Object.keys(g.imports).length;
      const edgeCount = Object.values(g.imports).reduce((sum, arr) => sum + arr.length, 0);
      console.log(chalk.cyan(`\n📖 Dependency Graph`));
      console.log(`  Files indexed: ${fileCount}`);
      console.log(`  Import edges:  ${edgeCount}`);
      if (g.lastUpdated) console.log(chalk.dim(`  Last updated:  ${g.lastUpdated}`));
      console.log(chalk.dim('\n  Run: lore graph <filepath>  for file details'));
      console.log(chalk.dim('  Run: lore graph --build     to rebuild from scratch'));
      return;
    }

    const index = readIndex();
    const normalized = path.relative(projectRoot, path.resolve(filepath)).replace(/\\/g, '/');

    const imports = g.imports[normalized] || [];
    const importedBy = g.importedBy[normalized] || [];

    if (imports.length === 0 && importedBy.length === 0) {
      console.log(chalk.yellow(`No graph data for ${filepath}`));
      console.log(chalk.dim('  Run: lore graph --build  to build the dependency graph'));
      return;
    }

    const entryCount = (file) => (index.files[file] || []).length;

    console.log(chalk.cyan(`\n📖 ${filepath}\n`));

    if (imports.length > 0) {
      console.log(chalk.bold('Imports:'));
      for (const dep of imports) {
        const n = entryCount(dep);
        const badge = n > 0 ? chalk.green(` → ${n} Lore entr${n === 1 ? 'y' : 'ies'}`) : chalk.dim(` → 0 Lore entries`);
        console.log(`  ${dep}${badge}`);
      }
      console.log();
    }

    if (importedBy.length > 0) {
      console.log(chalk.bold('Imported by:'));
      for (const dep of importedBy) {
        const n = entryCount(dep);
        const badge = n > 0 ? chalk.green(` → ${n} Lore entr${n === 1 ? 'y' : 'ies'}`) : chalk.dim(` → 0 Lore entries`);
        console.log(`  ${dep}${badge}`);
      }
      console.log();
    }
  } catch (e) {
    console.error(chalk.red(`Failed: ${e.message}`));
    process.exit(1);
  }
}

module.exports = graph;
