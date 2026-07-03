import { describe, it, expect } from 'vitest';
import { ScrollEngine } from './ScrollEngine';

const opts = { maxSpeed: 300, deadzone: 0.1 };

describe('ScrollEngine', () => {
  it('starts in HOLD and holds when centered', () => {
    const e = new ScrollEngine(opts);
    expect(e.state).toBe('HOLD');
    expect(e.velocity(0)).toBe(0);
    expect(e.state).toBe('HOLD');
  });
  it('goes MANUAL and scales velocity by deflection when the stick moves', () => {
    const e = new ScrollEngine(opts);
    expect(e.velocity(1)).toBeCloseTo(300, 5);
    expect(e.state).toBe('MANUAL');
  });
  it('reverses on downward stick', () => {
    const e = new ScrollEngine(opts);
    expect(e.velocity(-1)).toBeCloseTo(-300, 5);
  });
  it('cruises at max speed hands-free after toggleCruise', () => {
    const e = new ScrollEngine(opts);
    e.toggleCruise();
    expect(e.state).toBe('CRUISE');
    expect(e.velocity(0)).toBeCloseTo(300, 5);
    expect(e.state).toBe('CRUISE');
  });
  it('exits cruise to MANUAL when the stick is moved', () => {
    const e = new ScrollEngine(opts);
    e.toggleCruise();
    expect(e.velocity(1)).toBeCloseTo(300, 5);
    expect(e.state).toBe('MANUAL');
  });
  it('toggleCruise while cruising pauses to HOLD', () => {
    const e = new ScrollEngine(opts);
    e.toggleCruise();
    e.toggleCruise();
    expect(e.state).toBe('HOLD');
    expect(e.velocity(0)).toBe(0);
  });
  it('stop() forces HOLD', () => {
    const e = new ScrollEngine(opts);
    e.toggleCruise();
    e.stop();
    expect(e.state).toBe('HOLD');
  });
  it('clamps max speed on stepMaxSpeed', () => {
    const e = new ScrollEngine({ maxSpeed: 1490, deadzone: 0.1 });
    e.stepMaxSpeed(1);
    expect(e.maxSpeed).toBe(1500);
    e.maxSpeed = 40;
    e.stepMaxSpeed(-1);
    expect(e.maxSpeed).toBe(20);
  });
});
