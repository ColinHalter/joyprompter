import { describe, it, expect } from 'vitest';
import { ControlMapper } from './ControlMapper';
import { NEUTRAL_FRAME, type InputFrame } from '../types';

function frameWith(overrides: Partial<InputFrame['buttons']>): InputFrame {
  return {
    stick: { x: 0, y: 0 },
    buttons: { ...NEUTRAL_FRAME.buttons, ...overrides },
  };
}

describe('ControlMapper', () => {
  it('emits toggleCruise on a stick-click press edge', () => {
    const m = new ControlMapper();
    expect(m.update(frameWith({ stickClick: true }))).toEqual([{ type: 'toggleCruise' }]);
  });
  it('does not repeat a command while the button stays held', () => {
    const m = new ControlMapper();
    m.update(frameWith({ stickClick: true }));
    expect(m.update(frameWith({ stickClick: true }))).toEqual([]);
  });
  it('fires again after release then re-press', () => {
    const m = new ControlMapper();
    m.update(frameWith({ stickClick: true }));
    m.update(NEUTRAL_FRAME);
    expect(m.update(frameWith({ stickClick: true }))).toEqual([{ type: 'toggleCruise' }]);
  });
  it('maps the d-pad and shoulders', () => {
    const m = new ControlMapper();
    expect(m.update(frameWith({ up: true }))).toEqual([{ type: 'sizeStep', delta: 1 }]);
    m.update(NEUTRAL_FRAME);
    expect(m.update(frameWith({ down: true }))).toEqual([{ type: 'sizeStep', delta: -1 }]);
    m.update(NEUTRAL_FRAME);
    expect(m.update(frameWith({ right: true }))).toEqual([{ type: 'seek', delta: 1 }]);
    m.update(NEUTRAL_FRAME);
    expect(m.update(frameWith({ left: true }))).toEqual([{ type: 'seek', delta: -1 }]);
    m.update(NEUTRAL_FRAME);
    expect(m.update(frameWith({ sr: true }))).toEqual([{ type: 'maxSpeedStep', delta: 1 }]);
    m.update(NEUTRAL_FRAME);
    expect(m.update(frameWith({ sl: true }))).toEqual([{ type: 'maxSpeedStep', delta: -1 }]);
  });
  it('detects a re-press when the source mutates one frame object in place', () => {
    const m = new ControlMapper();
    const frame: InputFrame = { stick: { x: 0, y: 0 }, buttons: { ...NEUTRAL_FRAME.buttons } };
    frame.buttons.stickClick = true;
    expect(m.update(frame)).toEqual([{ type: 'toggleCruise' }]); // first press
    frame.buttons.stickClick = false;
    m.update(frame);                                             // release
    frame.buttons.stickClick = true;
    expect(m.update(frame)).toEqual([{ type: 'toggleCruise' }]); // re-press on SAME object
  });
});
