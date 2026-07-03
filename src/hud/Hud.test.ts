import { describe, it, expect } from 'vitest';
import { stateLabel } from './Hud';

describe('stateLabel', () => {
  it('maps scroll states to human labels', () => {
    expect(stateLabel('HOLD')).toBe('Paused');
    expect(stateLabel('MANUAL')).toBe('Manual');
    expect(stateLabel('CRUISE')).toBe('Cruise');
  });
});
