'use strict';

const path = require('path');
const { readIndex } = require('../../lib/index');
const { readEntry } = require('../../lib/entries');
const { loadGraph } = require('../../lib/graph');
const { enforceBudget } = require('../../lib/budget');
const { readConfig } = require('../../lib/config');

const toolDefinition = {
  name: 'lore_why',
  description: 'Retrieve architectural decisions and context for a specific file or directory. Returns all relevant Lore entries, including graph-propagated context from imported and importing modules.',
  inputSchema: {
    type: 'object',
    properties: {
      filepath: {
        type: 'string',
        description: 'The file or directory path to look up context for (relative to project root)',
      },
    },
    required: ['filepath'],
  },
};

async function handler(args) {
  const { filepath } = args;
  const config = readConfig();
  const budget = (config.mcp && config.mcp.tokenBudget) ? config.mcp.tokenBudget : 4000;

  try {
    const index = readIndex();
    const graph = loadGraph();
    const normalized = filepath.replace(/^\.\//, '');

    // Collect entry IDs with weights: { id → maxWeight }
    const weights = {};
    function addIds(ids, w) {
      for (const id of (ids || [])) {
        weights[id] = Math.max(weights[id] || 0, w);
      }
    }

    // Direct file match (1.0)
    addIds(index.files[normalized], 1.0);
    addIds(index.files[normalized + '/'], 1.0);

    // Ancestor directory walk (0.7)
    let current = normalized;
    while (true) {
      const parent = path.dirname(current);
      if (parent === current || parent === '.') break;
      addIds(index.files[parent + '/'], 0.7);
      current = parent;
    }

    // Graph: files this file imports (0.3)
    for (const dep of (graph.imports[normalized] || [])) {
      addIds(index.files[dep], 0.3);
    }

    // Graph: files that import this file (0.2)
    for (const dep of (graph.importedBy[normalized] || [])) {
      addIds(index.files[dep], 0.2);
    }

    if (Object.keys(weights).length === 0) {
      return {
        content: [{ type: 'text', text: `No Lore entries found for: ${filepath}` }],
      };
    }

    // Sort by weight descending
    const entries = [];
    for (const [id, weight] of Object.entries(weights)) {
      const entryPath = index.entries[id];
      const entry = readEntry(entryPath);
      if (entry) entries.push(Object.assign({}, entry, { _score: weight }));
    }
    entries.sort((a, b) => b._score - a._score);

    const context = enforceBudget(entries, budget);
    return { content: [{ type: 'text', text: context }] };
  } catch (e) {
    return {
      content: [{ type: 'text', text: `Error: ${e.message}` }],
      isError: true,
    };
  }
}

module.exports = { toolDefinition, handler };
