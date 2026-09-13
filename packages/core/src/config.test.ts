import { resolve } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';
import { resolveSyncatConfig } from './config';

describe('syncat config', () => {
  it('resolves project paths relative to the config file', () => {
    const config = resolveSyncatConfig(
      {
        source: '../template',
        target: '../business',
        files: [{ path: 'features/common/**' }],
      },
      '/workspace/config/syncat.config.ts',
    );

    expect(config.sourceDir).toBe(resolve('/workspace/config', '../template'));
    expect(config.targetDir).toBe(resolve('/workspace/config', '../business'));
  });

  it('rejects paths that can escape a project root', () => {
    expect(() =>
      resolveSyncatConfig(
        {
          source: '../template',
          target: '../business',
          files: [{ path: '../secrets.txt' }],
        },
        '/workspace/config/syncat.config.ts',
      ),
    ).toThrow('must not escape its project root');
  });

  it('rejects exclusion patterns that can escape a project root', () => {
    expect(() =>
      resolveSyncatConfig(
        {
          source: '../template',
          target: '../business',
          files: [{ path: 'features/**', exclude: ['../secrets/**'] }],
        },
        '/workspace/config/syncat.config.ts',
      ),
    ).toThrow('must not escape its project root');
  });

  it('rejects global exclusion patterns that can escape a project root', () => {
    expect(() =>
      resolveSyncatConfig(
        {
          source: '../template',
          target: '../business',
          exclude: ['../secrets/**'],
          files: [{ path: 'features/**' }],
        },
        '/workspace/config/syncat.config.ts',
      ),
    ).toThrow('must not escape its project root');
  });
});
