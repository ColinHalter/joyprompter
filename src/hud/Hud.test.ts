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

describe('Hud rendering stability', () => {
  it('reuses DOM nodes when the model is unchanged, so the toggle stays clickable', () => {
    const el = document.createElement('div');
    const hud = new Hud(el);
    hud.update(base);
    const first = el.querySelector('[data-action="flip-throttle"]');
    hud.update(base); // identical model — must not recreate the DOM mid-click
    const second = el.querySelector('[data-action="flip-throttle"]');
    expect(first).not.toBeNull();
    expect(second).toBe(first);
  });
  it('re-renders when the model changes', () => {
    const el = document.createElement('div');
    const hud = new Hud(el);
    hud.update({ ...base, inverted: false });
    expect(el.querySelector('[data-action="flip-throttle"]')?.textContent).toContain('↑ = forward');
    hud.update({ ...base, inverted: true });
    expect(el.querySelector('[data-action="flip-throttle"]')?.textContent).toContain('↑ = reverse');
  });
});
