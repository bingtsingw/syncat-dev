import { TextDecoder } from 'node:util';

const decoder = new TextDecoder('utf-8', { fatal: true });
const maximumComparisonCells = 1_000_000;

export function createUnifiedDiff(path: string, actual: Buffer, expected: Buffer): string {
  let actualText: string;
  let expectedText: string;
  try {
    actualText = decoder.decode(actual);
    expectedText = decoder.decode(expected);
  } catch {
    return `Binary files differ: ${path}\n`;
  }

  const before = actualText.split('\n');
  const after = expectedText.split('\n');
  if (before.length * after.length > maximumComparisonCells) {
    return `Diff omitted for ${path}: files are too large for a line-by-line comparison.\n`;
  }
  const table = Array.from({ length: before.length + 1 }, () => new Uint32Array(after.length + 1));

  for (let beforeIndex = before.length - 1; beforeIndex >= 0; beforeIndex -= 1) {
    for (let afterIndex = after.length - 1; afterIndex >= 0; afterIndex -= 1) {
      const beforeLine = getLine(before, beforeIndex);
      const afterLine = getLine(after, afterIndex);
      getRow(table, beforeIndex)[afterIndex] =
        beforeLine === afterLine
          ? getCell(table, beforeIndex + 1, afterIndex + 1) + 1
          : Math.max(getCell(table, beforeIndex + 1, afterIndex), getCell(table, beforeIndex, afterIndex + 1));
    }
  }

  const output = [`--- target/${path}`, `+++ expected/${path}`, `@@ -1,${before.length} +1,${after.length} @@`];
  let beforeIndex = 0;
  let afterIndex = 0;
  while (beforeIndex < before.length || afterIndex < after.length) {
    const beforeLine = beforeIndex < before.length ? getLine(before, beforeIndex) : undefined;
    const afterLine = afterIndex < after.length ? getLine(after, afterIndex) : undefined;

    if (beforeLine !== undefined && afterLine !== undefined && beforeLine === afterLine) {
      output.push(` ${beforeLine}`);
      beforeIndex += 1;
      afterIndex += 1;
    } else if (
      afterLine !== undefined &&
      (beforeLine === undefined ||
        getCell(table, beforeIndex, afterIndex + 1) >= getCell(table, beforeIndex + 1, afterIndex))
    ) {
      output.push(`+${afterLine}`);
      afterIndex += 1;
    } else {
      if (beforeLine === undefined) {
        throw new Error('Diff generation reached an invalid state.');
      }
      output.push(`-${beforeLine}`);
      beforeIndex += 1;
    }
  }

  return `${output.join('\n')}\n`;
}

function getCell(table: Uint32Array[], rowIndex: number, columnIndex: number): number {
  return getRow(table, rowIndex)[columnIndex] ?? 0;
}

function getLine(lines: string[], index: number): string {
  const line = lines[index];
  if (line === undefined) {
    throw new Error('Diff generation reached an invalid line index.');
  }
  return line;
}

function getRow(table: Uint32Array[], rowIndex: number): Uint32Array {
  const row = table[rowIndex];
  if (!row) {
    throw new Error('Diff generation reached an invalid table row.');
  }
  return row;
}
