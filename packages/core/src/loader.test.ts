import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { loadSyncatConfig } from './index';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('config loader', () => {
  it('loads only syncat.config.ts from the requested working directory', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'syncat-config-'));
    temporaryDirectories.push(cwd);
    await writeFile(
      join(cwd, 'syncat.config.ts'),
      "export default { source: './template', target: './business', files: [{ path: 'package.json' }] };\n",
    );

    const config = await loadSyncatConfig({ cwd });

    expect(config.configFile).toBe(join(cwd, 'syncat.config.ts'));
    expect(config.sourceDir).toBe(join(cwd, 'template'));
    expect(config.targetDir).toBe(join(cwd, 'business'));
  });
});
