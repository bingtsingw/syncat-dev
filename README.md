# syncat

`syncat` is a CLI for synchronizing selected files from a source directory to a target directory. Define the files you manage, inspect drift with `check`, and apply the expected content with `write`.

## Requirements

- Node.js `>=24.14.0`

## Installation

Install `@syncat-dev/cli` in the project that owns the synchronization configuration:

```bash
pnpm add -D @syncat-dev/cli
```

The executable is named `syncat`.

## Configuration

Create a `syncat.config.ts` file. `source` and `target` are resolved relative to the configuration file; `~/` is supported for home-directory paths.

```ts
import { defineConfig, text } from '@syncat-dev/cli';

export default defineConfig({
  source: '~/project/source',
  target: '~/project/target',
  files: [
    { path: 'features/common/**' },
    {
      path: 'package.json',
      strategy: text.replace([{ from: '@source/', to: '@target/' }]),
    },
  ],
});
```

Each `files[].path` is a relative path or glob applied to both project roots. Paths outside those roots are rejected.

## Commands

```bash
syncat check
syncat check --diff
syncat write
syncat write --dry-run
```

Pass `-c` or `--config` to use a configuration file at another path:

```bash
syncat check --config path/to/syncat.config.ts
```

`check` exits with `0` when every managed file matches, `1` when drift is found, and `2` for configuration or execution errors. Add `--json` to either command for machine-readable output.

`write` creates or updates only managed target files. It does not remove unlisted files, and applies changes with an atomic file replacement.

### Strategies

Files are copied unchanged by default. `text.replace()` transforms source content before comparison and writing:

```ts
text.replace([
  { from: '@source/', to: '@target/' },
  { from: 'sourceName', to: 'targetName', all: false },
]);
```

Replacements apply to every occurrence unless `all: false` is set. Text strategies require UTF-8 input and fail when a replacement source string is absent.

## License

MIT
