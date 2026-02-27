'use strict';

const fs = require('fs-extra');
const path = require('path');
const { LORE_DIR } = require('./index');

const GRAPH_PATH = () => path.join(LORE_DIR, 'graph.json');

function emptyGraph() {
  return {
    imports: {},    // filepath → [filepath]
    importedBy: {}, // filepath → [filepath]
    lastUpdated: new Date().toISOString(),
  };
}

function loadGraph() {
  const p = GRAPH_PATH();
  if (!fs.existsSync(p)) return emptyGraph();
  try { return fs.readJsonSync(p); } catch (e) { return emptyGraph(); }
}

function saveGraph(graph) {
  graph.lastUpdated = new Date().toISOString();
  fs.writeJsonSync(GRAPH_PATH(), graph, { spaces: 2 });
}

/**
 * For a given filepath, return graph-context entry IDs weighted by relationship.
 * @param {string} filepath  Normalized relative path
 * @param {object} graph
 * @param {object} index
 * @returns {{ imports: Array<{file,entryIds}>, importedBy: Array<{file,entryIds}> }}
 */
function getGraphContext(filepath, graph, index) {
  const normalized = filepath.replace(/^\.\//, '');
  const result = { imports: [], importedBy: [] };

  for (const dep of (graph.imports[normalized] || [])) {
    const entryIds = index.files[dep] || [];
    if (entryIds.length > 0) result.imports.push({ file: dep, entryIds });
  }
  for (const dep of (graph.importedBy[normalized] || [])) {
    const entryIds = index.files[dep] || [];
    if (entryIds.length > 0) result.importedBy.push({ file: dep, entryIds });
  }

  return result;
}

module.exports = { loadGraph, saveGraph, emptyGraph, getGraphContext };
