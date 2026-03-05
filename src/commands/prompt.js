'use strict';

const chalk = require('chalk');
const { requireInit } = require('../lib/guard');
const { findSimilar } = require('../lib/embeddings');
const { readIndex } = require('../lib/index');
const { readEntry } = require('../lib/entries');
const { formatPromptContext } = require('../lib/format');

async function promptCmd(queryArgs, options) {
    requireInit();

    const queryInfo = Array.isArray(queryArgs) ? queryArgs.join(' ') : (queryArgs || '');

    if (!queryInfo || queryInfo.trim().length === 0) {
        console.error(chalk.red('\nError: You must provide a query to generate a prompt.'));
        console.log(chalk.yellow('Example: lore prompt "I want to refactor the database"'));
        process.exit(1);
    }

    const query = queryInfo;

    try {
        const threshold = parseFloat(options.threshold) || 0.4;
        const limit = parseInt(options.limit, 10) || 10;

        const index = readIndex();
        const allIds = Object.keys(index.entries);

        let results = [];
        try {
            const similar = await findSimilar(query, allIds, limit);
            for (const { id, score } of similar) {
                if (score >= threshold) {
                    const entry = readEntry(index.entries[id]);
                    if (entry) results.push(entry);
                }
            }
        } catch (e) {
            console.error(chalk.yellow(`⚠️ Warning: Semantic search failed (${e.message}). Ensure Ollama is running.\nFallback text search will be used.`));
            // Basic text fallback
            const q = query.toLowerCase();
            for (const id of allIds) {
                const entry = readEntry(index.entries[id]);
                if (!entry) continue;
                const searchable = [entry.title, entry.context].join(' ').toLowerCase();
                if (searchable.includes(q)) results.push(entry);
            }
        }

        // The exact LLM-ready markdown string
        const markdownPrompt = formatPromptContext(query, results);

        // Print strictly to stdout without extra CLI fluff so it can be piped seamlessly
        console.log(markdownPrompt);

    } catch (e) {
        console.error(chalk.red(`\nFailed to generate prompt: ${e.message}\n`));
        process.exit(1);
    }
}

module.exports = promptCmd;
