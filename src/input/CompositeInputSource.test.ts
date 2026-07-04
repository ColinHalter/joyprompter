import { describe, it, expect } from 'vitest';
import { CompositeInputSource } from './CompositeInputSource';
import { NEUTRAL_FRAME, type InputFrame } from '../types';
import type { InputSource } from './InputSource';

function fakeSource(frame: Partial<InputFrame>): InputSource & { started: boolean } {
  const full: InputFrame = {
    stick: { x: 0, y: 0, ...(frame.stick ?? {}) },
    buttons: { ...NEUTRAL_FRAME.buttons, ...(frame.buttons ?? {}) },
  };
  return {
    started: false,
    start() { this.started = true; },
    stop() { this.started = false; },
    getFrame: () => full,
  };
}

describe('CompositeInputSource', () => {
  it('starts and stops every child source', () => {
    const a = fakeSource({});
    const b = fakeSource({});
    const c = new CompositeInputSource([a, b]);
    c.start();
    expect([a.started, b.started]).toEqual([true, true]);
    c.stop();
    expect([a.started, b.started]).toEqual([false, false]);
  });
  it('ORs buttons across sources', () => {
    const c = new CompositeInputSource([
      fakeSource({ buttons: { zl: true } }),
      fakeSource({ buttons: { up: true } }),
    ]);
    const f = c.getFrame();
    expect(f.buttons.zl).toBe(true);
    expect(f.buttons.up).toBe(true);
  });
  it('uses the first non-zero stick.y when multiple sources are deflected', () => {
    const c = new CompositeInputSource([
      fakeSource({ stick: { x: 0, y: 1 } }),
      fakeSource({ stick: { x: 0, y: -1 } }),
    ]);
    expect(c.getFrame().stick.y).toBe(1);
  });
  it('reports stick.y 0 when no source is deflected', () => {
    const c = new CompositeInputSource([fakeSource({}), fakeSource({})]);
    expect(c.getFrame().stick.y).toBe(0);
  });
});
