'use strict';

const { readIndex, writeIndex } = require('../../lib/index');
const { readEntry, writeEntry } = require('../../lib/entries');
const { saveDraft } = require('../../lib/drafts');
const { readConfig } = require('../../lib/config');

const toolDefinition = {
  name: 'lore_update',
  description: 'Update an existing Lore entry. Use this when a previous decision, invariant, gotcha, or graveyard item needs to be revised because the context has changed. Updates may be saved as drafts pending human review depending on project configuration.',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'The ID of the existing entry to update (e.g. "decision-use-postgres-1709876543")',
      },
      context: {
        type: 'string',
        description: 'Updated context/explanation. If provided, replaces the existing context.',
      },
      title: {
        type: 'string',
        description: 'Updated title. If provided, replaces the existing title.',
      },
      files: {
        type: 'array',
        items: { type: 'string' },
        description: 'Updated list of related files. If provided, replaces the existing file list.',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Updated tags. If provided, replaces existing tags.',
      },
      alternatives: {
        type: 'array',
        items: { type: 'string' },
        description: 'Updated alternatives considered.',
      },
      tradeoffs: {
        type: 'string',
        description: 'Updated tradeoffs.',
      },
    },
    required: ['id'],
  },
};

async function handler(args) {
  const { id, context, title, files, tags, alternatives, tradeoffs } = args;

  try {
    const index = readIndex();
    const entryPath = index.entries[id];

    if (!entryPath) {
      return {
        content: [{ type: 'text', text: `Entry not found: "${id}". Use lore_search to find the correct entry ID.` }],
        isError: true,
      };
    }

    const entry = readEntry(entryPath);
    if (!entry) {
      return {
        content: [{ type: 'text', text: `Failed to read entry: "${id}".` }],
        isError: true,
      };
    }

    const config = readConfig();
    const requireConfirmation = config.mcp && config.mcp.confirmEntries !== false;

    // Build a summary of what's changing
    const changes = [];
    if (title !== undefined && title !== entry.title) changes.push(`title: "${entry.title}" → "${title}"`);
    if (context !== undefined && context !== entry.context) changes.push('context updated');
    if (files !== undefined) changes.push(`files: [${files.join(', ')}]`);
    if (tags !== undefined) changes.push(`tags: [${tags.join(', ')}]`);
    if (alternatives !== undefined) changes.push(`alternatives: [${alternatives.join(', ')}]`);
    if (tradeoffs !== undefined) changes.push('tradeoffs updated');

    if (changes.length === 0) {
      return {
        content: [{ type: 'text', text: `No changes provided for entry "${id}".` }],
      };
    }

    if (requireConfirmation) {
      // Route update through drafts for human review
      const draftId = saveDraft({
        suggestedType: entry.type,
        suggestedTitle: title || entry.title,
        evidence: `[UPDATE to ${id}] ${context || entry.context}`,
        files: files || entry.files,
        tags: tags || entry.tags,
        alternatives: alternatives || entry.alternatives,
        tradeoffs: tradeoffs !== undefined ? tradeoffs : entry.tradeoffs,
        confidence: 0.95,
        source: 'mcp-update',
        updatesEntryId: id,
      });

      return {
        content: [{ type: 'text', text: `Update drafted for human review (${draftId}). Changes: ${changes.join('; ')}. The developer can approve it with: lore drafts` }],
      };
    }

    // Direct update (confirmEntries is explicitly false)
    if (title !== undefined) entry.title = title;
    if (context !== undefined) entry.context = context;
    if (files !== undefined) entry.files = files;
    if (tags !== undefined) entry.tags = tags;
    if (alternatives !== undefined) entry.alternatives = alternatives;
    if (tradeoffs !== undefined) entry.tradeoffs = tradeoffs;
    entry.lastUpdated = new Date().toISOString();

    writeEntry(entry);
    writeIndex(index);

    // Re-embed
    try {
      const { generateEmbedding, storeEmbedding } = require('../../lib/embeddings');
      const text = [entry.title, entry.context, ...(entry.alternatives || []), entry.tradeoffs || '', ...(entry.tags || [])].join(' ');
      const vector = await generateEmbedding(text);
      storeEmbedding(id, vector);
    } catch (e) {
      // Ollama not available — skip
    }

    return {
      content: [{ type: 'text', text: `Updated entry "${id}". Changes: ${changes.join('; ')}` }],
    };
  } catch (e) {
    return {
      content: [{ type: 'text', text: `Error updating entry: ${e.message}` }],
      isError: true,
    };
  }
}

module.exports = { toolDefinition, handler };
