# Throttle-Direction Toggle in the HUD

## Problem

The JoyCon stick's throttle direction is fixed at build time by `CONFIG.invertThrottle`.
If "up" scrolls the wrong way, the only fix is editing config and reloading. Users want to
flip it from the UI at runtime.

## Goal

A clickable HUD item that flips the JoyCon throttle direction live. Session-only: it starts
from `CONFIG.invertThrottle` on each load and is not persisted.

## Design

### State & data flow

`main.ts` owns a mutable `let invertThrottle = CONFIG.invertThrottle`. `JoyConHidInputSource`
reads the current value through an injected getter rather than importing `CONFIG.invertThrottle`
directly:

- `JoyConHidInputSource` constructor takes `opts: { getInvert: () => boolean }`.
- Its `onInputReport` calls `decodeThrottle(e.data, { threshold: CONFIG.stickThreshold, invert: this.opts.getInvert() })`.
- `main.ts`: `const joycon = new JoyConHidInputSource({ getInvert: () => invertThrottle })`.

`decodeThrottle` (the pure, unit-tested function in `joyconReport.ts`) is unchanged — it
already takes `invert` as a parameter. Only the source of that value changes.

The toggle affects the JoyCon stick throttle only; the keyboard fallback's Arrow ↑/↓ is not
inverted by it. `CONFIG.invertThrottle` remains the per-session default.

### HUD item & click handling

`Hud.update()` re-renders `innerHTML` every frame, so per-element listeners would be wiped.
Therefore:

- `HudModel` gains `inverted: boolean`.
- `Hud.update()` renders a clickable item as the last span:
  `<span class="hud-item hud-toggle" data-action="flip-throttle">${m.inverted ? '↑ = reverse' : '↑ = forward'}</span>`
- `main.ts` attaches ONE delegated click listener to the HUD container (`hudEl`). A click whose
  target is inside `[data-action="flip-throttle"]` flips `invertThrottle` and calls
  `markActivity(...)` so the HUD stays visible.
- `styles.css` adds `.hud-toggle { cursor: pointer; text-decoration: underline; }`.

### HUD visibility (fade)

The HUD auto-hides after `CONFIG.hudHideMs` of inactivity and currently only un-hides on
controller input, so the item could be invisible when reached for with the mouse. `main.ts`
adds a `mousemove` listener on `window` that calls `markActivity(performance.now())`, so any
mouse movement reveals the HUD and the item is reliably clickable.

### Testing

- Add a `Hud` unit test: `update({ inverted: false, ... })` renders `↑ = forward` and includes
  `data-action="flip-throttle"`; `update({ inverted: true, ... })` renders `↑ = reverse`.
- `decodeThrottle` behavior is already covered and unchanged.
- The click wiring and getter injection live in the untested I/O/wiring layer
  (`main.ts` / `JoyConHidInputSource`), verified hands-on.

### Documentation

- `JOYCON-SETUP.md` Tuning: note the throttle direction can be flipped in-app by clicking the
  HUD direction item; `CONFIG.invertThrottle` is now just the starting default.
- `README.md` Configuration table: update the `invertThrottle` row to mention the in-app toggle.

## Out of scope

- Persistence across reloads (localStorage) — session-only by decision.
- Inverting the keyboard fallback throttle.
- Any other HUD interactivity.
