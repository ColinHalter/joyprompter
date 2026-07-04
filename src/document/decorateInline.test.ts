import { describe, it, expect } from 'vitest';
import { decorateInline } from './decorateInline';

function decorate(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  decorateInline(root);
  return root;
}

describe('decorateInline', () => {
  it('wraps ==text== in a <mark>, dropping the == markers', () => {
    const root = decorate('<p>a ==highlight== b</p>');
    const mark = root.querySelector('mark');
    expect(mark?.textContent).toBe('highlight');
    expect(root.textContent).toBe('a highlight b');
  });
  it('wraps [text] in a purple bracket span, keeping the brackets', () => {
    const root = decorate('<p>wait [beat] go</p>');
    const span = root.querySelector('.tp-bracket');
    expect(span?.textContent).toBe('[beat]');
  });
  it('handles both markers and multiple matches in one text node', () => {
    const root = decorate('<p>[a] and ==b== and [c]</p>');
    expect(root.querySelectorAll('.tp-bracket').length).toBe(2);
    expect(root.querySelector('mark')?.textContent).toBe('b');
  });
  it('does not decorate inside code, pre, or links', () => {
    const root = decorate('<p><code>[x]</code> <a href="#">[y]</a> ==z==</p>');
    expect(root.querySelectorAll('.tp-bracket').length).toBe(0);
    expect(root.querySelector('code')?.textContent).toBe('[x]');
    // the ==z== outside code/link still becomes a mark
    expect(root.querySelector('mark')?.textContent).toBe('z');
  });
  it('leaves plain text without markers untouched', () => {
    const root = decorate('<p>nothing special here</p>');
    expect(root.querySelector('.tp-bracket')).toBeNull();
    expect(root.querySelector('mark')).toBeNull();
    expect(root.querySelector('p')?.textContent).toBe('nothing special here');
  });
});

describe('decorateInline — unclosed line highlight', () => {
  it('highlights a whole line that starts with == and has no closing ==', () => {
    const root = decorate('<p>==the whole line</p>');
    expect(root.querySelector('mark')?.textContent).toBe('the whole line');
    expect(root.textContent).toBe('the whole line'); // == hidden
  });
  it('applies per line after a hard break', () => {
    const root = decorate('<p>first<br>==second line</p>');
    expect(root.querySelector('mark')?.textContent).toBe('second line');
    expect(root.textContent).toBe('firstsecond line');
  });
  it('does not treat a mid-line == as a whole-line highlight', () => {
    const root = decorate('<p><strong>bold</strong> ==tail</p>');
    expect(root.querySelector('mark')).toBeNull();
    expect(root.textContent).toBe('bold ==tail');
  });
  it('preserves leading whitespace outside the highlight', () => {
    const root = decorate('<p>  ==indented</p>');
    expect(root.querySelector('mark')?.textContent).toBe('indented');
    expect(root.textContent).toBe('  indented');
  });
  it('still highlights only the inner text for a closed ==x==', () => {
    const root = decorate('<p>==closed== rest</p>');
    expect(root.querySelector('mark')?.textContent).toBe('closed');
    expect(root.textContent).toBe('closed rest');
  });
});
