import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KeyInputSource } from './KeyInputSource';

const press = (key: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key }));
const release = (key: string) => window.dispatchEvent(new KeyboardEvent('keyup', { key }));

describe('KeyInputSource', () => {
  let src: KeyInputSource;
  beforeEach(() => { src = new KeyInputSource(); src.start(); });
  afterEach(() => { src.stop(); });

  it('reports +1 while ArrowUp is held', () => {
    press('ArrowUp');
    expect(src.getFrame().stick.y).toBe(1);
  });
  it('reports -1 while ArrowDown is held', () => {
    press('ArrowDown');
    expect(src.getFrame().stick.y).toBe(-1);
  });
  it('reports 0 when nothing is held', () => {
    expect(src.getFrame().stick.y).toBe(0);
  });
  it('cancels to 0 when both arrows are held', () => {
    press('ArrowUp');
    press('ArrowDown');
    expect(src.getFrame().stick.y).toBe(0);
  });
  it('resolves to the remaining direction when one of two held arrows is released', () => {
    press('ArrowUp');
    press('ArrowDown');
    release('ArrowUp');
    expect(src.getFrame().stick.y).toBe(-1);
  });
  it('maps configured keys to buttons', () => {
    press('z'); // CONFIG.keyMap.z -> 'zl'
    expect(src.getFrame().buttons.zl).toBe(true);
  });
});
