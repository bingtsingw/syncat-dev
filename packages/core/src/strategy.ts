import { TextDecoder } from 'node:util';
import { SyncatError } from './errors';
import type { StrategyConfig } from './types';

const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

export function renderDesiredContent(source: Buffer, strategy: StrategyConfig | undefined, path: string): Buffer {
  if (!strategy || strategy.type === 'copy') {
    return source;
  }

  let text: string;
  try {
    text = utf8Decoder.decode(source);
  } catch {
    throw new SyncatError(`Text strategy cannot process non-UTF-8 file: ${path}`);
  }

  for (const replacement of strategy.replacements) {
    const occurrences = text.split(replacement.from).length - 1;
    if (occurrences === 0) {
      throw new SyncatError(`Replacement source was not found in ${path}: ${JSON.stringify(replacement.from)}`);
    }

    text =
      replacement.all === false
        ? text.replace(replacement.from, replacement.to)
        : text.split(replacement.from).join(replacement.to);
  }

  return Buffer.from(text, 'utf8');
}
