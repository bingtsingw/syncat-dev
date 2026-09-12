import { realpath } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { z } from 'zod';
import { SyncatError } from './errors';
import type { ResolvedSyncatConfig, SyncatConfig } from './types';

const replaceRuleSchema = z
  .object({
    from: z.string().min(1, 'Replacement "from" must not be empty.'),
    to: z.string(),
    all: z.boolean().optional(),
  })
  .strict();

const strategySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('copy') }).strict(),
  z
    .object({
      type: z.literal('text-replace'),
      replacements: z.array(replaceRuleSchema).min(1, 'A text-replace strategy needs at least one replacement.'),
    })
    .strict(),
]);

export const syncatConfigSchema = z
  .object({
    source: z.string().min(1),
    target: z.string().min(1),
    files: z
      .array(
        z
          .object({
            path: z.string().min(1),
            exclude: z.array(z.string().min(1)).optional(),
            strategy: strategySchema.optional(),
          })
          .strict(),
      )
      .min(1, 'At least one file rule is required.'),
  })
  .strict();

export function defineConfig<T extends SyncatConfig>(config: T): T {
  return config;
}

export function resolveSyncatConfig(rawConfig: unknown, configFile: string): ResolvedSyncatConfig {
  const parsed = syncatConfigSchema.safeParse(rawConfig);
  if (!parsed.success) {
    throw new SyncatError(`Invalid syncat config:\n${z.prettifyError(parsed.error)}`);
  }

  const configDir = dirname(configFile);
  const sourceDir = resolveConfigPath(parsed.data.source, configDir);
  const targetDir = resolveConfigPath(parsed.data.target, configDir);

  for (const rule of parsed.data.files) {
    assertSafeRulePath(rule.path);
    for (const pattern of rule.exclude ?? []) {
      assertSafeRulePath(pattern);
    }
  }

  return {
    config: parsed.data,
    configFile,
    sourceDir,
    targetDir,
  };
}

export function resolveConfigPath(value: string, cwd: string): string {
  const home = process.env['HOME'] ?? process.env['USERPROFILE'];
  const expanded =
    value === '~' && home ? home : value.startsWith('~/') && home ? resolve(home, value.slice(2)) : value;
  return resolve(cwd, expanded);
}

export function assertSafeRulePath(value: string): void {
  if (isAbsolute(value) || value.includes('\\')) {
    throw new SyncatError(`File rule path must be a relative POSIX path: ${value}`);
  }

  const segments = value.split('/');
  if (segments.some((segment) => segment === '..') || value === '.' || value.startsWith('../')) {
    throw new SyncatError(`File rule path must not escape its project root: ${value}`);
  }
}

export function assertPathInside(root: string, candidate: string): void {
  const pathRelative = relative(root, candidate);
  if (
    pathRelative === '' ||
    (!pathRelative.startsWith(`..${sep}`) && pathRelative !== '..' && !isAbsolute(pathRelative))
  ) {
    return;
  }
  throw new SyncatError(`Resolved path escapes its project root: ${candidate}`);
}

export async function assertRealPathInside(root: string, candidate: string): Promise<void> {
  const [realRoot, realCandidate] = await Promise.all([realpath(root), realpath(candidate)]);
  assertPathInside(realRoot, realCandidate);
}

export async function assertExistingAncestorInside(root: string, candidate: string): Promise<void> {
  const realRoot = await realpath(root);
  let ancestor = candidate;

  while (true) {
    try {
      const realAncestor = await realpath(ancestor);
      assertPathInside(realRoot, realAncestor);
      return;
    } catch (error) {
      if (!isNotFound(error)) {
        throw error;
      }
      const parent = dirname(ancestor);
      if (parent === ancestor) {
        throw new SyncatError(`Could not find an existing ancestor for path: ${candidate}`);
      }
      ancestor = parent;
    }
  }
}

function isNotFound(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
