'use strict';

const fs = require('fs-extra');
const path = require('path');
const { readIndex } = require('../../lib/index');
const { readEntry } = require('../../lib/entries');
const { checkStaleness } = require('../../lib/stale');
const { checkPatternStaleness } = require('../../watcher/staleness');

const toolDefinition = {
  name: 'lore_stale',
  description: 'Check which Lore entries may be outdated. Combines mtime-based staleness (files changed since entry was written) with pattern-based semantic checks (e.g. new HTTP calls in performance paths, architecture shifts).',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

async function handler() {
  try {
    const index = readIndex();
    const projectRoot = process.cwd();
    const staleItems = [];

    for (const [id, entryPath] of Object.entries(index.entries)) {
      const entry = readEntry(entryPath);
      if (!entry) continue;

      // mtime-based staleness (existing)
      const staleFiles = checkStaleness(entry);
      for (const s of staleFiles) {
        const daysText = s.daysAgo === 0 ? 'today' : `${s.daysAgo} day${s.daysAgo === 1 ? '' : 's'} ago`;

        // Pattern-based semantic staleness on the changed file
        const reasons = [];
        try {
          const absPath = path.resolve(projectRoot, s.filepath);
          if (fs.existsSync(absPath)) {
            const code = fs.readFileSync(absPath, 'utf8');
            const patternReasons = checkPatternStaleness(entry, s.filepath, code);
            reasons.push(...patternReasons);
          }
        } catch (e) { /* ignore read errors */ }

        staleItems.push({
          id: entry.id,
          title: entry.title,
          type: entry.type,
          file: s.filepath,
          changedDaysAgo: s.daysAgo,
          daysText,
          reasons,
        });
      }
    }

    if (staleItems.length === 0) {
      return {
        content: [{ type: 'text', text: 'All Lore entries are up to date.' }],
      };
    }

    const lines = ['The following Lore entries may be outdated:\n'];
    for (const item of staleItems) {
      lines.push(`• [${item.type.toUpperCase()}] ${item.title} (${item.id})`);
      lines.push(`  File changed: ${item.file} (${item.daysText})`);
      if (item.reasons.length > 0) {
        for (const r of item.reasons) {
          lines.push(`  ⚠  ${r}`);
        }
      }
      lines.push(`  Review with: lore edit ${item.id}`);
      lines.push('');
    }

    return {
      content: [{ type: 'text', text: lines.join('\n') }],
    };
  } catch (e) {
    return {
      content: [{ type: 'text', text: `Error: ${e.message}` }],
      isError: true,
    };
  }
}

module.exports = { toolDefinition, handler };
