import { resolve } from 'node:path';
import { loadConfig } from 'c12';
import { resolveSyncatConfig } from './config';
import type { ResolvedSyncatConfig } from './types';

export { applySyncPlan } from './apply';
export { defineConfig, resolveSyncatConfig } from './config';
export { createUnifiedDiff } from './diff';
export { SyncatError } from './errors';
export { buildSyncPlan } from './plan';
export type {
  ApplyResult,
  CopyStrategy,
  FileRule,
  PlanEntryStatus,
  ReplaceRule,
  ResolvedSyncatConfig,
  StrategyConfig,
  SyncatConfig,
  SyncPlan,
  SyncPlanEntry,
  TextReplaceStrategy,
} from './types';

export async function loadSyncatConfig(
  options: { configPath?: string; cwd?: string } = {},
): Promise<ResolvedSyncatConfig> {
  const cwd = options.cwd ?? process.cwd();
  const configPath = resolve(cwd, options.configPath ?? 'syncat.config.ts');
  const loaded = await loadConfig({
    name: 'syncat',
    cwd,
    configFile: configPath,
    configFileRequired: true,
    dotenv: false,
    envName: false,
    extend: false,
    giget: false,
    globalRc: false,
    packageJson: false,
    rcFile: false,
  });

  if (!loaded.configFile) {
    throw new Error('Could not determine the loaded syncat config file.');
  }

  return resolveSyncatConfig(loaded.config, loaded.configFile);
}
