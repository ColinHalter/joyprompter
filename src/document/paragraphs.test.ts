import { describe, it, expect } from 'vitest';
import { itemsToText, textToParagraphs, nextParagraphOffset } from './paragraphs';

describe('itemsToText', () => {
  it('joins items and inserts newlines on hasEOL', () => {
    const items = [
      { str: 'Hello ', hasEOL: false },
      { str: 'world', hasEOL: true },
      { str: 'next line', hasEOL: true },
    ];
    expect(itemsToText(items)).toBe('Hello world\nnext line\n');
  });
});

describe('textToParagraphs', () => {
  it('splits on every line break, keeping each line as its own paragraph', () => {
    const text = 'Line one\nline one cont.\n\nSecond para\n';
    expect(textToParagraphs(text)).toEqual(['Line one', 'line one cont.', 'Second para']);
  });
  it('collapses runs of horizontal whitespace within a line', () => {
    expect(textToParagraphs('  Spaced   out \ttext ')).toEqual(['Spaced out text']);
  });
  it('returns an empty array for whitespace-only text', () => {
    expect(textToParagraphs('   \n\n  \n')).toEqual([]);
  });
});

describe('nextParagraphOffset', () => {
  const offsets = [0, 100, 250, 400];
  it('jumps to the next paragraph forward', () => {
    expect(nextParagraphOffset(offsets, 100, 1)).toBe(250);
  });
  it('jumps to the previous paragraph backward', () => {
    expect(nextParagraphOffset(offsets, 260, -1)).toBe(250);
  });
  it('clamps at the ends', () => {
    expect(nextParagraphOffset(offsets, 500, 1)).toBe(400);
    expect(nextParagraphOffset(offsets, 0, -1)).toBe(0);
  });
  it('returns currentTop when there are no offsets', () => {
    expect(nextParagraphOffset([], 123, 1)).toBe(123);
  });
});
