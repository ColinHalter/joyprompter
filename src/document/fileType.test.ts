import { describe, it, expect } from 'vitest';
import { fileKind } from './fileType';

describe('fileKind', () => {
  it('detects markdown by extension', () => {
    expect(fileKind({ name: 'script.md', type: '' })).toBe('markdown');
    expect(fileKind({ name: 'NOTES.MARKDOWN', type: '' })).toBe('markdown');
  });
  it('detects markdown by MIME type', () => {
    expect(fileKind({ name: 'noext', type: 'text/markdown' })).toBe('markdown');
  });
  it('treats PDFs and everything else as pdf', () => {
    expect(fileKind({ name: 'doc.pdf', type: 'application/pdf' })).toBe('pdf');
    expect(fileKind({ name: 'mystery', type: '' })).toBe('pdf');
  });
});
