'use strict';

const chalk = require('chalk');
const inquirer = require('inquirer');
const path = require('path');
const fs = require('fs-extra');
const { listDrafts, acceptDraft, deleteDraft } = require('../lib/drafts');
const { LORE_DIR } = require('../lib/index');
const { requireInit } = require('../lib/guard');

async function drafts(options) {
  requireInit();

  const pending = listDrafts();

  if (pending.length === 0) {
    console.log(chalk.green('✓ No pending drafts'));
    return;
  }

  // Auto mode: accept high-confidence, leave rest
  if (options.auto) {
    let accepted = 0;
    for (const draft of pending) {
      if ((draft.confidence || 0) >= 0.8) {
        acceptDraft(draft.draftId);
        console.log(chalk.green(`  ✓ ${draft.suggestedTitle}`));
        accepted++;
      }
    }
    const remaining = pending.length - accepted;
    console.log(chalk.green(`\n📖 Auto-accepted ${accepted} draft${accepted === 1 ? '' : 's'}`));
    if (remaining > 0) {
      console.log(chalk.cyan(`   ${remaining} remaining — run: lore drafts`));
    }
    return;
  }

  console.log(chalk.cyan(`\n📖 ${pending.length} pending draft${pending.length === 1 ? '' : 's'}\n`));

  const choices = pending.map((draft, i) => {
    const conf = Math.round((draft.confidence || 0) * 100);
    const typeColor = {
      decision: chalk.blue,
      invariant: chalk.red,
      gotcha: chalk.yellow,
      graveyard: chalk.dim,
    }[draft.suggestedType] || chalk.white;

    // Create a nicely formatted display string
    const title = draft.suggestedTitle.length > 50 ? draft.suggestedTitle.slice(0, 47) + '...' : draft.suggestedTitle;
    const display = `${typeColor(draft.suggestedType.toUpperCase().padEnd(9))} | ${title.padEnd(50)} | Conf: ${conf}%`;

    return {
      name: display,
      value: draft,
      checked: conf >= 80 // Pre-check high confidence ones
    };
  });

  let selectedDrafts;
  try {
    const ans = await inquirer.prompt([{
      type: 'checkbox',
      name: 'selected',
      message: 'Select drafts to ACCEPT (unselected drafts will be kept pending):',
      choices: choices,
      pageSize: 15
    }]);
    selectedDrafts = ans.selected;
  } catch (e) {
    console.log(chalk.yellow('\nAborted.'));
    return;
  }

  if (selectedDrafts.length === 0) {
    console.log(chalk.yellow('\nNo drafts selected. Keeping all drafts pending.'));
  } else {
    console.log(chalk.cyan(`\nAccepting ${selectedDrafts.length} drafts...`));
    for (const draft of selectedDrafts) {
      const entry = acceptDraft(draft.draftId);
      console.log(chalk.green(`  ✓ ${draft.suggestedTitle} -> Saved as ${entry.id}`));
    }
  }

  // Ask about deletions for remaining
  const remainingDrafts = pending.filter(p => !selectedDrafts.find(s => s.draftId === p.draftId));

  if (remainingDrafts.length > 0) {
    console.log();
    let deleteSelection;
    try {
      const deleteAns = await inquirer.prompt([{
        type: 'checkbox',
        name: 'deletes',
        message: 'Select drafts to permanently DELETE:',
        choices: remainingDrafts.map(draft => ({
          name: `${draft.suggestedType.toUpperCase().padEnd(9)} | ${draft.suggestedTitle}`,
          value: draft
        })),
        pageSize: 10
      }]);
      deleteSelection = deleteAns.deletes;
    } catch (e) {
      return;
    }

    if (deleteSelection.length > 0) {
      console.log(chalk.yellow(`\nDeleting ${deleteSelection.length} drafts...`));
      for (const draft of deleteSelection) {
        deleteDraft(draft.draftId);
        console.log(chalk.dim(`  ✗ Deleted: ${draft.suggestedTitle}`));
      }
    }
  }

  console.log(chalk.green('\n✓ Draft review complete'));
}

module.exports = drafts;
