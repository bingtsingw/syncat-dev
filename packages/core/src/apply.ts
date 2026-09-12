import { randomUUID } from 'node:crypto';
import { chmod, lstat, mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { assertRealPathInside } from './config';
import { SyncatError } from './errors';
import type { ApplyResult, SyncPlan } from './types';

export async function applySyncPlan(plan: SyncPlan, options: { dryRun: boolean }): Promise<ApplyResult> {
  const written = plan.drift;
  if (options.dryRun) {
    return { dryRun: true, written };
  }

  for (const entry of written) {
    await writeEntry(plan.config.targetDir, entry.sourcePath, entry.targetPath, entry.desiredContent);
  }

  return { dryRun: false, written };
}

async function writeEntry(targetRoot: string, sourcePath: string, targetPath: string, contents: Buffer): Promise<void> {
  await mkdir(dirname(targetPath), { recursive: true });
  await assertRealPathInside(targetRoot, dirname(targetPath));
  await rejectTargetSymlink(targetPath);

  const sourceStat = await stat(sourcePath);
  const temporaryPath = join(dirname(targetPath), `.${basename(targetPath)}.syncat-${randomUUID()}.tmp`);

  try {
    await writeFile(temporaryPath, contents, { mode: sourceStat.mode });
    await chmod(temporaryPath, sourceStat.mode);
    await rename(temporaryPath, targetPath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw new SyncatError(`Failed to write ${targetPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function rejectTargetSymlink(path: string): Promise<void> {
  try {
    const targetStat = await lstat(path);
    if (targetStat.isSymbolicLink()) {
      throw new SyncatError(`Refusing to overwrite symbolic link target: ${path}`);
    }
  } catch (error) {
    if (isNotFound(error)) {
      return;
    }
    throw error;
  }
}

function isNotFound(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
