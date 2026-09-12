export interface ReplaceRule {
  from: string;
  to: string;
  all?: boolean;
}

export interface CopyStrategy {
  type: 'copy';
}

export interface TextReplaceStrategy {
  type: 'text-replace';
  replacements: ReplaceRule[];
}

export type StrategyConfig = CopyStrategy | TextReplaceStrategy;

export interface FileRule {
  path: string;
  exclude?: string[];
  strategy?: StrategyConfig;
}

export interface SyncatConfig {
  source: string;
  target: string;
  files: FileRule[];
}

export interface ResolvedSyncatConfig {
  config: SyncatConfig;
  configFile: string;
  sourceDir: string;
  targetDir: string;
}

export type PlanEntryStatus = 'synced' | 'missing' | 'changed';

export interface SyncPlanEntry {
  path: string;
  sourcePath: string;
  targetPath: string;
  sourceContent: Buffer;
  targetContent?: Buffer;
  desiredContent: Buffer;
  status: PlanEntryStatus;
}

export interface SyncPlan {
  config: ResolvedSyncatConfig;
  entries: SyncPlanEntry[];
  drift: SyncPlanEntry[];
}

export interface ApplyResult {
  dryRun: boolean;
  written: SyncPlanEntry[];
}
