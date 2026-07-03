export interface RawTextItem {
  str: string;
  hasEOL: boolean;
}

export function itemsToText(items: RawTextItem[]): string {
  return items.map((i) => i.str + (i.hasEOL ? '\n' : '')).join('');
}

export function textToParagraphs(text: string): string[] {
  return text
    .split(/\n[ \t]*\n+/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').replace(/[ \t]+/g, ' ').trim())
    .filter((p) => p.length > 0);
}

export function nextParagraphOffset(
  offsets: number[],
  currentTop: number,
  delta: 1 | -1,
): number {
  if (offsets.length === 0) return currentTop;
  const eps = 1;
  if (delta === 1) {
    for (const o of offsets) if (o > currentTop + eps) return o;
    return offsets[offsets.length - 1];
  }
  for (let i = offsets.length - 1; i >= 0; i--) {
    if (offsets[i] < currentTop - eps) return offsets[i];
  }
  return 0;
}
