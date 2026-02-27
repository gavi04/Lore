'use strict';

const { listDrafts, getDraftCount } = require('../../lib/drafts');

const toolDefinition = {
  name: 'lore_drafts',
  description: 'Returns the count and summary of pending Lore drafts — automatically captured signals (file deletions, comment mining, commit messages, repeated edits) that have not yet been reviewed. Use this to surface the draft queue to the developer.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

async function handler() {
  try {
    const count = getDraftCount();

    if (count === 0) {
      return {
        content: [{ type: 'text', text: 'No pending Lore drafts. Your knowledge base is up to date.' }],
      };
    }

    const drafts = listDrafts();
    const lines = [
      `You have ${count} unreviewed Lore draft${count === 1 ? '' : 's'} — run \`lore drafts\` to review.\n`,
    ];

    for (const draft of drafts.slice(0, 10)) {
      const confidence = Math.round((draft.confidence || 0) * 100);
      const files = (draft.files || []).slice(0, 2).join(', ');
      lines.push(`• [${(draft.suggestedType || 'decision').toUpperCase()}] ${draft.suggestedTitle || draft.draftId}`);
      if (files) lines.push(`  Files: ${files}`);
      lines.push(`  Confidence: ${confidence}%  |  Evidence: ${(draft.evidence || '').slice(0, 80)}`);
      lines.push('');
    }

    if (drafts.length > 10) {
      lines.push(`  … and ${drafts.length - 10} more. Run \`lore drafts\` to see all.`);
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
