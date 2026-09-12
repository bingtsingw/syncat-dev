import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import packageJson from '../package.json';

const temporaryDirectories: string[] = [];
const cliPath = fileURLToPath(new URL('../dist/cli.js', import.meta.url));

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('syncat CLI', () => {
  it('reports the package version', async () => {
    const result = await runCli(process.cwd(), ['--version']);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain(`syncat/${packageJson.version}`);
  });

  it('checks, writes, and rechecks managed files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'syncat-cli-'));
    temporaryDirectories.push(root);
    const sourceDir = join(root, 'source');
    const targetDir = join(root, 'target');
    const configPath = join(root, 'syncat.config.ts');

    await mkdir(join(sourceDir, 'features'), { recursive: true });
    await mkdir(targetDir, { recursive: true });
    await writeFile(join(sourceDir, 'features', 'common.ts'), 'export const name = "template";\n');
    await writeFile(join(sourceDir, 'package.json'), '{"name":"@source/db"}\n');
    await writeFile(
      configPath,
      [
        'export default {',
        "  source: './source',",
        "  target: './target',",
        '  files: [',
        "    { path: 'features/**' },",
        "    { path: 'package.json', strategy: { type: 'text-replace', replacements: [{ from: '@source/', to: '@target/' }] } },",
        '  ],',
        '};',
        '',
      ].join('\n'),
    );

    const initialCheck = await runCli(root, ['check', '--config', configPath, '--json']);
    expect(initialCheck.stderr).toBe('');
    expect(initialCheck.exitCode).toBe(1);
    expect(JSON.parse(initialCheck.stdout)).toMatchObject({
      command: 'check',
      summary: { total: 2, drift: 2 },
      files: [
        { path: 'features/common.ts', status: 'missing' },
        { path: 'package.json', status: 'missing' },
      ],
    });

    const write = await runCli(root, ['write', '--config', configPath, '--json']);
    expect(write.exitCode).toBe(0);
    expect(JSON.parse(write.stdout)).toMatchObject({
      command: 'write',
      dryRun: false,
      summary: { changed: 2 },
    });
    expect(await readFile(join(targetDir, 'features', 'common.ts'), 'utf8')).toBe('export const name = "template";\n');
    expect(await readFile(join(targetDir, 'package.json'), 'utf8')).toBe('{"name":"@target/db"}\n');

    const finalCheck = await runCli(root, ['check', '--config', configPath, '--json']);
    expect(finalCheck.exitCode).toBe(0);
    expect(JSON.parse(finalCheck.stdout)).toMatchObject({ summary: { total: 2, synchronized: 2, drift: 0 } });
  });
});

async function runCli(
  cwd: string,
  arguments_: string[],
): Promise<{ exitCode: number | null; stderr: string; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...arguments_], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.once('error', reject);
    child.once('close', (exitCode) => {
      resolve({ exitCode, stderr, stdout });
    });
  });
}
