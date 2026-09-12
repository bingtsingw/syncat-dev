import { applySyncPlan, buildSyncPlan, createUnifiedDiff, loadSyncatConfig, type SyncPlan } from '@syncat-dev/core';

interface CheckOptions {
  config?: string;
  diff?: boolean;
  json?: boolean;
}

interface WriteOptions {
  config?: string;
  dryRun?: boolean;
  json?: boolean;
}

export async function runCheck(options: CheckOptions): Promise<void> {
  const config = await loadSyncatConfig({ configPath: options.config });
  const plan = await buildSyncPlan(config);

  if (options.json) {
    writeJson('check', plan);
  } else {
    writeCheckReport(plan, options.diff ?? false);
  }

  if (plan.drift.length > 0) {
    process.exitCode = 1;
  }
}

export async function runWrite(options: WriteOptions): Promise<void> {
  const config = await loadSyncatConfig({ configPath: options.config });
  const plan = await buildSyncPlan(config);
  const result = await applySyncPlan(plan, { dryRun: options.dryRun ?? false });

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          command: 'write',
          configFile: plan.config.configFile,
          dryRun: result.dryRun,
          summary: { changed: result.written.length },
          files: result.written.map(({ path, status }) => ({ path, status })),
        },
        null,
        2,
      )}\n`,
    );
    return;
  }

  if (result.written.length === 0) {
    process.stdout.write('syncat: target is already synchronized.\n');
    return;
  }

  const verb = options.dryRun ? 'would write' : 'wrote';
  for (const entry of result.written) {
    process.stdout.write(`${verb} ${entry.path}\n`);
  }
  process.stdout.write(`syncat: ${result.written.length} file(s) ${options.dryRun ? 'would change' : 'updated'}.\n`);
}

function writeCheckReport(plan: SyncPlan, includeDiff: boolean): void {
  if (plan.drift.length === 0) {
    process.stdout.write(`syncat: synchronized (${plan.entries.length} file(s)).\n`);
    return;
  }

  for (const entry of plan.drift) {
    process.stdout.write(`${entry.status} ${entry.path}\n`);
    if (includeDiff && entry.status === 'changed' && entry.targetContent) {
      process.stdout.write(createUnifiedDiff(entry.path, entry.targetContent, entry.desiredContent));
    }
  }
  process.stdout.write(`syncat: ${plan.drift.length} file(s) differ.\n`);
}

function writeJson(command: 'check', plan: SyncPlan): void {
  process.stdout.write(
    `${JSON.stringify(
      {
        command,
        configFile: plan.config.configFile,
        source: plan.config.sourceDir,
        target: plan.config.targetDir,
        summary: {
          total: plan.entries.length,
          synchronized: plan.entries.filter((entry) => entry.status === 'synced').length,
          drift: plan.drift.length,
        },
        files: plan.entries.map(({ path, status }) => ({ path, status })),
      },
      null,
      2,
    )}\n`,
  );
}
