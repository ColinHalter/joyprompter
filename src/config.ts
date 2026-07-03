import type { ButtonState } from './types';

export const CONFIG = {
  // Throttle (stick-as-mouse via Pointer Lock)
  mouseFullThrottleRate: 1200, // px/s of mouse movement that maps to full throttle
  invertThrottle: false,       // flip if QJoyControl's mouse Y is inverted
  deadzone: 0.08,
  minMaxSpeed: 20,    // px/s
  maxMaxSpeed: 1500,  // px/s
  maxSpeedStep: 60,   // px/s per D-pad up/down press
  initialMaxSpeed: 300,
  // Text
  minFontSize: 16,    // px
  maxFontSize: 160,   // px
  fontSizeStep: 4,    // px per SL/SR press
  initialFontSize: 48,
  // HUD
  hudHideMs: 2500,
  // Keys the app listens for (map QJoyControl buttons to these).
  keyMap: {
    i: 'up',      // D-pad up    -> max speed up
    k: 'down',    // D-pad down  -> max speed down
    j: 'left',    // D-pad left  -> seek back
    l: 'right',   // D-pad right -> seek forward
    q: 'sl',      // SL          -> text size down
    e: 'sr',      // SR          -> text size up
    z: 'zl',      // ZL          -> toggle cruise
  } as Record<string, keyof ButtonState>,
};
