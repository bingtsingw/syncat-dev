import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { applySyncPlan } from './apply';
import { buildSyncPlan } from './plan';
import type { ResolvedSyncatConfig } from './types';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('sync plan', () => {
  it('writes missing files and becomes synchronized', async () => {
    const config = await createFixture({ path: 'features/common.ts', source: 'export const value = 1;\n' });

    const initialPlan = await buildSyncPlan(config);
    expect(initialPlan.drift).toHaveLength(1);
    expect(initialPlan.drift[0]).toMatchObject({ status: 'missing' });

    await applySyncPlan(initialPlan, { dryRun: false });
    expect(await readFile(join(config.targetDir, 'features/common.ts'), 'utf8')).toBe('export const value = 1;\n');

    expect((await buildSyncPlan(config)).drift).toHaveLength(0);
  });

  it('renders text replacements before comparing and writing', async () => {
    const config = await createFixture({
      path: 'package.json',
      source: '{"name":"@source/db"}\n',
      strategy: { type: 'text-replace', replacements: [{ from: '@source/', to: '@target/' }] },
    });

    const plan = await buildSyncPlan(config);
    await applySyncPlan(plan, { dryRun: false });

    expect(await readFile(join(config.targetDir, 'package.json'), 'utf8')).toBe('{"name":"@target/db"}\n');
  });

  it('does not write files in dry-run mode', async () => {
    const config = await createFixture({ path: 'features/common.ts', source: 'export const value = 1;\n' });
    const plan = await buildSyncPlan(config);

    const result = await applySyncPlan(plan, { dryRun: true });

    expect(result.written).toHaveLength(1);
    await expect(readFile(join(config.targetDir, 'features/common.ts'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});

async function createFixture(input: {
  path: string;
  source: string;
  strategy?: ResolvedSyncatConfig['config']['files'][number]['strategy'];
}): Promise<ResolvedSyncatConfig> {
  const root = await mkdtemp(join(tmpdir(), 'syncat-core-'));
  temporaryDirectories.push(root);
  const sourceDir = join(root, 'source');
  const targetDir = join(root, 'target');
  await mkdir(join(sourceDir, input.path.split('/').slice(0, -1).join('/')), { recursive: true });
  await mkdir(targetDir, { recursive: true });
  await writeFile(join(sourceDir, input.path), input.source);

  return {
    configFile: join(root, 'syncat.config.ts'),
    sourceDir,
    targetDir,
    config: {
      source: sourceDir,
      target: targetDir,
      files: [{ path: input.path, strategy: input.strategy }],
    },
  };
}
