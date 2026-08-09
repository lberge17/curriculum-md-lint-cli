#!/usr/bin/env node

const path = require('path');
const _chalk = require('chalk');
const chalk = _chalk && _chalk.default ? _chalk.default : _chalk;
const { lintFiles, runSpellcheck } = require('../lib/lint');

function parseCliArgs(argv) {
  const patterns = [];
  const options = { disabledRules: [] };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--disable') {
      const value = argv[i + 1];
      if (value) {
        options.disabledRules.push(value);
        i += 1;
      }
    } else if (arg.startsWith('--disable=')) {
      options.disabledRules.push(arg.slice('--disable='.length));
    } else {
      patterns.push(arg);
    }
  }

  return { patterns: patterns.length ? patterns : ['**/*.md'], options };
}

async function main() {
  const { patterns, options } = parseCliArgs(process.argv.slice(2));

  try {
    const results = await lintFiles(patterns, options);

    let totalProblems = 0;
    for (const r of results) {
      if (!r.messages || r.messages.length === 0) continue;
      console.log(chalk.bold.underline(r.file));
      for (const m of r.messages) {
        totalProblems++;
        const pos = m.location ? `${m.location.start.line}:${m.location.start.column}` : '-';
        const rule = m.ruleId ? ` [${m.ruleId}]` : '';
        const severity = m.fatal ? chalk.red('error') : chalk.yellow('warning');
        console.log(`  ${chalk.gray(pos)} ${severity}${rule} ${m.message}`);
      }
      console.log('');
    }

    // run optional spellcheck if cspell is available
    const spell = await runSpellcheck(results.map(r => r.file));
    if (spell && spell.found === false) {
      console.log(chalk.green('cspell not found; skip spellcheck.'));
    } else if (spell) {
      if (spell.problems && spell.problems.length) {
        console.log(chalk.bold.underline('Spelling issues from cspell:'));
        spell.problems.forEach(p => console.log(p));
        totalProblems += spell.problems.length;
      }
    }

    if (totalProblems > 0) {
      console.log(chalk.redBright(`Found ${totalProblems} problems.`));
      process.exitCode = 2;
    } else {
      console.log(chalk.green('No problems found.'));
    }
  } catch (err) {
    console.error(chalk.red('Error:'), err && err.message ? err.message : err);
    process.exitCode = 1;
  }
}

main();
