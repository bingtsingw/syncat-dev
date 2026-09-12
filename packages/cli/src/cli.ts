#!/usr/bin/env node

import { cac } from 'cac';
import packageJson from '../package.json';
import { runCheck, runWrite } from './commands';

const cli = cac('syncat');

cli
  .command('check', 'Check whether target files match the rendered source files.')
  .option('-c, --config <path>', 'Path to syncat.config.ts')
  .option('--diff', 'Print a unified diff for each differing text file.')
  .option('--json', 'Print machine-readable JSON.')
  .action((options) => {
    void runCheck(options).catch(reportError);
  });

cli
  .command('write', 'Write differing source files into the target project.')
  .option('-c, --config <path>', 'Path to syncat.config.ts')
  .option('--dry-run', 'Print planned writes without changing files.')
  .option('--json', 'Print machine-readable JSON.')
  .action((options) => {
    void runWrite(options).catch(reportError);
  });

cli.help();
cli.version(packageJson.version);
cli.parse();

function reportError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`syncat: ${message}\n`);
  process.exitCode = 2;
}
