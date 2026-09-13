import { lstat, readFile, realpath, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import fastGlob from 'fast-glob';
import { assertExistingAncestorInside, assertPathInside, assertRealPathInside } from './config';
import { SyncatError } from './errors';
import { renderDesiredContent } from './strategy';
import type { ResolvedSyncatConfig, SyncPlan, SyncPlanEntry } from './types';

const globSyntax = /[*?[\]{}]/;

export async function buildSyncPlan(config: ResolvedSyncatConfig): Promise<SyncPlan> {
  await assertDirectory(config.sourceDir, 'source');
  await assertDirectory(config.targetDir, 'target');
  const [realSourceDir, realTargetDir] = await Promise.all([realpath(config.sourceDir), realpath(config.targetDir)]);
  if (realSourceDir === realTargetDir) {
    throw new SyncatError('Configured source and target directories must be different.');
  }

  const entries: SyncPlanEntry[] = [];
  const seenPaths = new Set<string>();

  for (const rule of config.config.files) {
    const exclude = [...(config.config.exclude ?? []), ...(rule.exclude ?? [])];
    const paths = await resolveRulePaths(config.sourceDir, rule.path, exclude);
    if (paths.length === 0) {
      throw new SyncatError(`File rule matched no source files: ${rule.path}`);
    }

    for (const path of paths) {
      if (seenPaths.has(path)) {
        throw new SyncatError(`A source file is managed by more than one rule: ${path}`);
      }
      seenPaths.add(path);

      const sourcePath = resolve(config.sourceDir, path);
      const targetPath = resolve(config.targetDir, path);
      assertPathInside(config.sourceDir, sourcePath);
      assertPathInside(config.targetDir, targetPath);
      await assertRealPathInside(config.sourceDir, sourcePath);
      await assertRegularFile(sourcePath, 'source');

      const sourceContent = await readFile(sourcePath);
      const desiredContent = renderDesiredContent(sourceContent, rule.strategy, path);
      const targetContent = await readOptionalRegularFile(config.targetDir, targetPath);
      const status = !targetContent ? 'missing' : targetContent.equals(desiredContent) ? 'synced' : 'changed';

      entries.push({
        path,
        sourcePath,
        targetPath,
        sourceContent,
        targetContent,
        desiredContent,
        status,
      });
    }
  }

  entries.sort((left, right) => left.path.localeCompare(right.path));
  return { config, entries, drift: entries.filter((entry) => entry.status !== 'synced') };
}

async function resolveRulePaths(sourceDir: string, rulePath: string, exclude: string[] | undefined): Promise<string[]> {
  if (!globSyntax.test(rulePath) && (!exclude || exclude.length === 0)) {
    return [rulePath];
  }

  return fastGlob(rulePath, {
    cwd: sourceDir,
    onlyFiles: true,
    dot: true,
    followSymbolicLinks: false,
    ignore: exclude,
    unique: true,
  });
}

async function assertDirectory(path: string, label: string): Promise<void> {
  let fileStat;
  try {
    fileStat = await stat(path);
  } catch {
    throw new SyncatError(`Configured ${label} directory does not exist: ${path}`);
  }
  if (!fileStat.isDirectory()) {
    throw new SyncatError(`Configured ${label} path is not a directory: ${path}`);
  }
}

async function assertRegularFile(path: string, label: string): Promise<void> {
  const fileStat = await lstat(path);
  if (!fileStat.isFile()) {
    throw new SyncatError(`Managed ${label} path is not a regular file: ${path}`);
  }
}

async function readOptionalRegularFile(targetRoot: string, path: string): Promise<Buffer | undefined> {
  try {
    await assertExistingAncestorInside(targetRoot, path);
    await assertRegularFile(path, 'target');
    await assertRealPathInside(targetRoot, path);
    return await readFile(path);
  } catch (error) {
    if (isNotFound(error)) {
      return undefined;
    }
    throw error;
  }
}

function isNotFound(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
