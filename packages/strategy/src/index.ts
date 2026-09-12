import type { ReplaceRule, TextReplaceStrategy } from '@syncat-dev/core';

export const text = {
  replace(replacements: ReplaceRule[]): TextReplaceStrategy {
    return { type: 'text-replace', replacements };
  },
};
