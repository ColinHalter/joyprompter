import { describe, it, expect } from 'vitest';
import { splitHardBreakLines } from './lineSplit';

describe('splitHardBreakLines', () => {
  it('splits a <br>-separated paragraph into block line spans', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>line one<br>line two<br>line three</p>';
    splitHardBreakLines(root);
    const lines = root.querySelectorAll('p .tp-line');
    expect(lines.length).toBe(3);
    expect(lines[0].textContent).toBe('line one');
    expect(lines[2].textContent).toBe('line three');
    expect(root.querySelectorAll('br').length).toBe(0);
  });
  it('preserves inline formatting within a line', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>a <strong>bold</strong><br>next</p>';
    splitHardBreakLines(root);
    const lines = root.querySelectorAll('.tp-line');
    expect(lines.length).toBe(2);
    expect(lines[0].querySelector('strong')?.textContent).toBe('bold');
    expect(lines[1].textContent).toBe('next');
  });
  it('leaves blocks without <br> untouched', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>single line</p>';
    splitHardBreakLines(root);
    expect(root.querySelector('.tp-line')).toBeNull();
    expect(root.querySelector('p')?.textContent).toBe('single line');
  });
});
