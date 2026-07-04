import { describe, it, expect } from 'vitest';
import { renderMarkdownToHtml } from './markdown';

describe('renderMarkdownToHtml', () => {
  it('renders a heading', () => {
    expect(renderMarkdownToHtml('# Title')).toContain('<h1');
  });
  it('renders bold and italic', () => {
    const html = renderMarkdownToHtml('**bold** and *italic*');
    expect(html).toContain('<strong>');
    expect(html).toContain('<em>');
  });
  it('renders a bullet list', () => {
    const html = renderMarkdownToHtml('- a\n- b');
    expect(html).toContain('<ul>');
    expect((html.match(/<li>/g) ?? []).length).toBe(2);
  });
  it('preserves single line breaks as <br> (breaks: true)', () => {
    expect(renderMarkdownToHtml('line one\nline two')).toContain('<br');
  });
});
