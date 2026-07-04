import { describe, it, expect } from 'vitest';
import { stateLabel, Hud, type HudModel } from './Hud';

const base: HudModel = {
  connected: true,
  state: 'MANUAL',
  maxSpeed: 300,
  fontSize: 48,
  progress: 0,
  inverted: false,
};

describe('stateLabel', () => {
  it('maps scroll states to human labels', () => {
    expect(stateLabel('HOLD')).toBe('Paused');
    expect(stateLabel('MANUAL')).toBe('Manual');
    expect(stateLabel('CRUISE')).toBe('Cruise');
  });
});

describe('Hud throttle-direction item', () => {
  it('renders "up = forward" with a flip action when not inverted', () => {
    const el = document.createElement('div');
    new Hud(el).update({ ...base, inverted: false });
    const toggle = el.querySelector('[data-action="flip-throttle"]');
    expect(toggle).not.toBeNull();
    expect(toggle?.textContent).toContain('↑ = forward');
  });
  it('renders "up = reverse" when inverted', () => {
    const el = document.createElement('div');
    new Hud(el).update({ ...base, inverted: true });
    expect(el.querySelector('[data-action="flip-throttle"]')?.textContent).toContain('↑ = reverse');
  });
});
