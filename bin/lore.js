#!/usr/bin/env node
'use strict';

const { Command } = require('commander');

const program = new Command();

program
  .name('lore')
  .description('Persistent project memory for developers')
  .version('0.1.0')
  .action(() => program.outputHelp());

program
  .command('init')
  .description('Initialize Lore in the current project')
  .action(require('../src/commands/init'));

program
  .command('log')
  .description('Log a new decision, invariant, graveyard entry, or gotcha')
  .option('--type <type>', 'Entry type (decision|invariant|graveyard|gotcha)')
  .option('--title <title>', 'Entry title')
  .option('--context <context>', 'Context/reason')
  .option('--alternatives <alternatives>', 'Alternatives considered')
  .option('--tradeoffs <tradeoffs>', 'Tradeoffs')
  .option('--tags <tags>', 'Comma-separated tags')
  .option('--files <files>', 'Comma-separated file paths')
  .action(require('../src/commands/log'));

program
  .command('why <filepath>')
  .description('Show all Lore entries linked to a file or directory')
  .action(require('../src/commands/why'));

program
  .command('status')
  .description('Show entry counts and stale warnings')
  .action(require('../src/commands/status'));

program
  .command('stale')
  .description('Show detailed stale entry report')
  .action(require('../src/commands/stale'));

program
  .command('search <query>')
  .description('Search all entries for a keyword')
  .action(require('../src/commands/search'));

program
  .command('export')
  .description('Export all entries to CLAUDE.md at project root')
  .action(require('../src/commands/export'));

program
  .command('edit <id>')
  .description('Open an entry JSON in VSCode')
  .action(require('../src/commands/edit'));

program
  .command('serve')
  .description('Start the Lore MCP server (stdio) for use with Claude Code')
  .option('-q, --quiet', 'Suppress startup messages (use when piped into MCP client)')
  .action(require('../src/commands/serve'));

program
  .command('embed')
  .description('Build semantic search index using Ollama (requires ollama pull nomic-embed-text)')
  .action(require('../src/commands/embed'));

program
  .command('onboard')
  .description('Print a re-onboarding brief for this project')
  .option('--days <n>', 'Only show if away for at least N days', '0')
  .action(require('../src/commands/onboard'));

program
  .command('watch')
  .description('Watch project for decisions and mine comments passively')
  .option('-d, --daemon', 'Run as background daemon')
  .option('--stop', 'Stop the running background daemon')
  .option('--daemon-worker', { hidden: true })
  .action(require('../src/commands/watch'));

program
  .command('mine [path]')
  .description('Mine source files for lore-worthy comments and create drafts')
  .action(require('../src/commands/mine'));

program
  .command('drafts')
  .description('Review and approve auto-captured draft entries')
  .option('--auto', 'Auto-accept drafts with confidence >= 0.8')
  .action(require('../src/commands/drafts'));

program
  .command('score')
  .description('Show the Lore Score — memory health metric for this project')
  .action(require('../src/commands/score'));

program
  .command('graph [filepath]')
  .description('Show or build the module dependency graph')
  .option('--build', 'Rebuild the full graph from source')
  .action(require('../src/commands/graph'));

program.parse(process.argv);
