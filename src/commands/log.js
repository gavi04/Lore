'use strict';

const chalk = require('chalk');
const inquirer = require('inquirer');
const { readIndex, writeIndex, addEntryToIndex } = require('../lib/index');
const { requireInit } = require('../lib/guard');
const { writeEntry, generateId, findDuplicate } = require('../lib/entries');
const { getRecentFiles } = require('../lib/git');

async function log(options) {
  requireInit();
  try {
    const index = readIndex();

    let type, title, context, alternatives, tradeoffs, tags, files;

    // Inline mode: all three required fields provided as flags
    if (options.type && options.title && options.context) {
      type = options.type;
      title = options.title;
      context = options.context;
      alternatives = options.alternatives ? [options.alternatives] : [];
      tradeoffs = options.tradeoffs || '';
      tags = options.tags ? options.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
      files = options.files ? options.files.split(',').map(f => f.trim()).filter(Boolean) : [];
    } else {
      // Interactive mode
      const recentFiles = getRecentFiles();

      const prompts = [
        {
          type: 'list',
          name: 'type',
          message: 'Entry type:',
          choices: ['decision', 'invariant', 'graveyard', 'gotcha'],
          default: options.type || 'decision',
        },
        {
          type: 'input',
          name: 'title',
          message: 'Title:',
          default: options.title || '',
          validate: v => v.trim().length > 0 || 'Title is required',
        },
        {
          type: 'input',
          name: 'context',
          message: 'Context (why?):',
          default: options.context || '',
          validate: v => v.trim().length > 0 || 'Context is required',
        },
        {
          type: 'input',
          name: 'alternatives',
          message: 'Alternatives considered (optional, press Enter to skip):',
        },
        {
          type: 'input',
          name: 'tradeoffs',
          message: 'Tradeoffs (optional, press Enter to skip):',
        },
        {
          type: 'input',
          name: 'tags',
          message: 'Tags (comma-separated, optional):',
        },
      ];

      if (recentFiles.length > 0) {
        prompts.push({
          type: 'checkbox',
          name: 'files',
          message: 'Link to files (recent git changes — space to select):',
          choices: recentFiles,
        });
      }

      prompts.push({
        type: 'input',
        name: 'extraFiles',
        message: 'Additional file paths (comma-separated, optional):',
      });

      const answers = await inquirer.prompt(prompts);

      type = answers.type;
      title = answers.title;
      context = answers.context;
      alternatives = answers.alternatives ? [answers.alternatives] : [];
      tradeoffs = answers.tradeoffs || '';
      tags = answers.tags ? answers.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
      files = answers.files ? [...answers.files] : [];

      if (answers.extraFiles) {
        const extra = answers.extraFiles.split(',').map(f => f.trim()).filter(Boolean);
        files = [...files, ...extra];
      }
    }

    const validTypes = ['decision', 'invariant', 'graveyard', 'gotcha'];
    if (!validTypes.includes(type)) {
      console.error(chalk.red(`Invalid type "${type}". Must be one of: ${validTypes.join(', ')}`));
      process.exit(1);
    }

    // Deduplication check
    const duplicate = findDuplicate(index, type, title);
    if (duplicate) {
      const matchLabel = duplicate.match === 'exact' ? 'Exact duplicate' : 'Similar entry';
      console.log(chalk.yellow(`\n⚠ ${matchLabel} found: ${chalk.bold(duplicate.entry.id)}`));
      console.log(chalk.dim(`  Title: "${duplicate.entry.title}"\n`));

      // In inline mode (flags), just warn and exit
      if (options.type && options.title && options.context) {
        console.log(chalk.yellow('Skipping to avoid duplicate. Use a different title or edit the existing entry.'));
        return;
      }

      // In interactive mode, ask user
      const { proceed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'proceed',
        message: 'Create entry anyway?',
        default: false,
      }]);
      if (!proceed) {
        console.log(chalk.dim('Aborted.'));
        return;
      }
    }

    const id = generateId(type, title);
    const entry = {
      id,
      type,
      title,
      date: new Date().toISOString(),
      files,
      context,
      alternatives: alternatives.filter(Boolean),
      tradeoffs,
      tags,
    };

    const entryPath = writeEntry(entry);
    addEntryToIndex(index, entry);
    writeIndex(index);

    console.log(chalk.green(`✓ Saved to ${entryPath}`));

    // Auto-embed if Ollama is available and autoEmbed is enabled
    try {
      const { readConfig } = require('../lib/config');
      const config = readConfig();
      if (config.embed && config.embed.autoEmbed) {
        const { generateEmbedding, storeEmbedding } = require('../lib/embeddings');
        const text = [title, context, ...alternatives.filter(Boolean), tradeoffs, ...tags].join(' ');
        const vector = await generateEmbedding(text);
        storeEmbedding(id, vector);
        console.log(chalk.dim('  (embedding stored)'));
      }
    } catch (e) {
      // Ollama not running — skip silently
    }
  } catch (e) {
    if (e.message && e.message.includes('force closed')) {
      console.log(chalk.yellow('\nAborted.'));
      process.exit(0);
    }
    console.error(chalk.red(`Failed to log entry: ${e.message}`));
    process.exit(1);
  }
}

module.exports = log;
