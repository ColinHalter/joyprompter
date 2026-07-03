import { describe, it, expect } from 'vitest';
import { applyDeadzone } from './throttle';

describe('applyDeadzone', () => {
  it('returns 0 inside the deadzone', () => {
    expect(applyDeadzone(0, 0.1)).toBe(0);
    expect(applyDeadzone(0.05, 0.1)).toBe(0);
    expect(applyDeadzone(-0.1, 0.1)).toBe(0);
  });
  it('rescales so full deflection maps to 1', () => {
    expect(applyDeadzone(1, 0.1)).toBeCloseTo(1, 5);
    expect(applyDeadzone(-1, 0.1)).toBeCloseTo(-1, 5);
  });
  it('is proportional just past the deadzone', () => {
    expect(applyDeadzone(0.55, 0.1)).toBeCloseTo(0.5, 5);
  });
  it('preserves sign', () => {
    expect(applyDeadzone(-0.55, 0.1)).toBeCloseTo(-0.5, 5);
  });
});
