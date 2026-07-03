import { describe, it, expect } from 'vitest';
import { mouseRateToStick } from './mouseRateToStick';

describe('mouseRateToStick', () => {
  const rate = 1000; // px/s at full throttle

  it('returns 0 when dt is 0 (no elapsed time)', () => {
    expect(mouseRateToStick(-50, 0, rate)).toBe(0);
  });

  it('returns 0 when fullThrottleRate is 0', () => {
    expect(mouseRateToStick(-50, 0.1, 0)).toBe(0);
  });

  it('maps upward movement (negative movementY) to forward (positive stick)', () => {
    // moved -1000px over 1s => rate -1000 => stick +1
    expect(mouseRateToStick(-1000, 1, rate)).toBeCloseTo(1, 5);
  });

  it('maps downward movement to reverse (negative stick)', () => {
    expect(mouseRateToStick(1000, 1, rate)).toBeCloseTo(-1, 5);
  });

  it('is proportional below full throttle', () => {
    // -500px over 1s => rate -500 => stick +0.5
    expect(mouseRateToStick(-500, 1, rate)).toBeCloseTo(0.5, 5);
  });

  it('clamps to [-1, 1] above full throttle', () => {
    expect(mouseRateToStick(-5000, 1, rate)).toBe(1);
    expect(mouseRateToStick(5000, 1, rate)).toBe(-1);
  });

  it('honors invert', () => {
    expect(mouseRateToStick(-1000, 1, rate, true)).toBeCloseTo(-1, 5);
  });
});
