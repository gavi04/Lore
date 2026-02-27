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

program.parse(process.argv);
