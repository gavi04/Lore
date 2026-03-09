'use strict';

const { readIndex, writeIndex, addEntryToIndex } = require('../../lib/index');
const { generateId, writeEntry, findDuplicate } = require('../../lib/entries');
const { readConfig } = require('../../lib/config');
const { saveDraft } = require('../../lib/drafts');

const toolDefinition = {
  name: 'lore_log',
  description: 'Create a new Lore entry to record an architectural decision, invariant, gotcha, or graveyard item. Use this when you make a significant technical decision that future developers (or AI) should know about. Note: entries may be saved as drafts pending human review depending on project configuration.',
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
    const index = readIndex();

    // Deduplication check
    const duplicate = findDuplicate(index, type, title);
    if (duplicate) {
      const matchLabel = duplicate.match === 'exact' ? 'Exact duplicate' : 'Similar entry';
      return {
        content: [{ type: 'text', text: `${matchLabel} already exists: "${duplicate.entry.title}" (${duplicate.entry.id}). No new entry created.` }],
      };
    }

    const config = readConfig();
    const requireConfirmation = config.mcp && config.mcp.confirmEntries !== false;

    if (requireConfirmation) {
      // Route to drafts for human review
      const draftId = saveDraft({
        suggestedType: type,
        suggestedTitle: title,
        evidence: context,
        files,
        tags,
        alternatives,
        tradeoffs,
        confidence: 0.9,
        source: 'mcp-log',
      });

      return {
        content: [{ type: 'text', text: `Draft created for human review: "${title}" (${draftId}). The developer can approve it with: lore drafts` }],
      };
    }

    // Direct entry creation (confirmEntries is explicitly false)
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

