'use strict';

const { readIndex, writeIndex, addEntryToIndex } = require('../../lib/index');
const { generateId, writeEntry } = require('../../lib/entries');

const toolDefinition = {
  name: 'lore_log',
  description: 'Create a new Lore entry to record an architectural decision, invariant, gotcha, or graveyard item. Use this when you make a significant technical decision that future developers (or AI) should know about.',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['decision', 'invariant', 'gotcha', 'graveyard'],
        description: 'Type of entry to create',
      },
      title: {
        type: 'string',
        description: 'Short, descriptive title for the decision or note',
      },
      context: {
        type: 'string',
        description: 'Full explanation: what was decided, why, what problem it solves',
      },
      files: {
        type: 'array',
        items: { type: 'string' },
        description: 'Files or directories this entry relates to (relative paths)',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional tags for categorization',
      },
      alternatives: {
        type: 'array',
        items: { type: 'string' },
        description: 'Alternative approaches that were considered',
      },
      tradeoffs: {
        type: 'string',
        description: 'Known tradeoffs or downsides of this decision',
      },
    },
    required: ['type', 'title', 'context'],
  },
};

async function handler(args) {
  const { type, title, context, files = [], tags = [], alternatives = [], tradeoffs = '' } = args;

  try {
    const id = generateId(type, title);
    const entry = {
      id,
      type,
      title,
      context,
      files,
      tags,
      alternatives,
      tradeoffs,
      date: new Date().toISOString(),
    };

    writeEntry(entry);

    const index = readIndex();
    addEntryToIndex(index, entry);
    writeIndex(index);

    // Auto-embed if possible
    try {
      const { generateEmbedding, storeEmbedding } = require('../../lib/embeddings');
      const text = [title, context, ...alternatives, tradeoffs, ...tags].join(' ');
      const vector = await generateEmbedding(text);
      storeEmbedding(id, vector);
    } catch (e) {
      // Ollama not available — skip embedding silently
    }

    return {
      content: [{ type: 'text', text: `Created ${type}: ${title} (${id})` }],
    };
  } catch (e) {
    return {
      content: [{ type: 'text', text: `Error creating entry: ${e.message}` }],
      isError: true,
    };
  }
}

module.exports = { toolDefinition, handler };
