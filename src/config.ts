import type { ButtonState } from './types';

export const CONFIG = {
  // Scroll throttle
  deadzone: 0.08,
  stickThreshold: 700,   // raw JoyCon stick units from center to trigger the binary throttle
  invertThrottle: false, // flip if pushing the stick up scrolls the wrong way
  minMaxSpeed: 20,    // px/s
  maxMaxSpeed: 1500,  // px/s
  maxSpeedStep: 10,   // px/s per D-pad up/down press
  initialMaxSpeed: 100,
  // Text
  minFontSize: 16,    // px
  maxFontSize: 160,   // px
  fontSizeStep: 4,    // px per SL/SR press
  initialFontSize: 48,
  // HUD
  hudHideMs: 2500,
  // Keyboard-fallback keys the app listens for (each maps to a controller action).
  keyMap: {
    i: 'up',      // D-pad up    -> max speed up
    k: 'down',    // D-pad down  -> max speed down
    j: 'left',    // D-pad left  -> seek back
    l: 'right',   // D-pad right -> seek forward
    q: 'sl',      // SL          -> text size down
    e: 'sr',      // SR          -> text size up
    z: 'zl',      // ZL          -> toggle cruise
    m: 'capture', // Capture     -> mirror the screen
  } as Record<string, keyof ButtonState>,
};
