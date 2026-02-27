'use strict';

const chalk = require('chalk');
const { readIndex } = require('../lib/index');
const { readEntry } = require('../lib/entries');
const { generateEmbedding, storeEmbedding } = require('../lib/embeddings');
const { requireInit } = require('../lib/guard');

async function embed() {
  requireInit();
  try {
    const index = readIndex();
    const ids = Object.keys(index.entries);

    if (ids.length === 0) {
      console.log(chalk.yellow('No entries to embed. Run lore log first.'));
      return;
    }

    console.log(chalk.cyan(`📖 Embedding ${ids.length} entries using Ollama...`));
    let success = 0;
    let failed = 0;

    for (const id of ids) {
      const entryPath = index.entries[id];
      const entry = readEntry(entryPath);
      if (!entry) continue;

      const text = [
        entry.title,
        entry.context,
        ...(entry.alternatives || []),
        entry.tradeoffs || '',
        ...(entry.tags || []),
      ].join(' ');

      try {
        const vector = await generateEmbedding(text);
        storeEmbedding(id, vector);
        process.stdout.write(chalk.green('.'));
        success++;
      } catch (e) {
        process.stdout.write(chalk.red('x'));
        failed++;
      }
    }

    console.log('');
    console.log(chalk.green(`✓ Embedded ${success}/${ids.length} entries`));
    if (failed > 0) {
      console.log(chalk.yellow(`⚠ ${failed} failed (is Ollama running? Run: ollama pull nomic-embed-text)`));
    }
  } catch (e) {
    if (e.message && e.message.includes('Ollama')) {
      console.error(chalk.red('Ollama not available. Start Ollama and run: ollama pull nomic-embed-text'));
    } else {
      console.error(chalk.red(`Failed to embed: ${e.message}`));
    }
    process.exit(1);
  }
}

module.exports = embed;
