# Binary Throttle via QJoyControl Stick→Keys

## Problem

The analog stick drives scrolling through a proportional throttle: QJoyControl maps
the stick to OS mouse movement, `mouseRateToStick` converts the per-frame mouse-movement
*rate* into a normalized `stick.y ∈ [-1, 1]`, and `ScrollEngine.velocity` multiplies that
deflection by `maxSpeed`. In testing this proportional feel is unsatisfying.

The desired behavior: the stick is a binary up/down control. Any up deflection scrolls
forward at `maxSpeed`; any down deflection scrolls backward at `maxSpeed`; centered holds.

## Key insight

We only need direction, not magnitude. The entire mouse-movement pipeline (Pointer Lock,
`mouseRateToStick`, movement accumulation, the click-to-engage / Esc UX) exists solely to
recover analog resolution. Once the throttle is binary, that pipeline is dead weight — and
its per-frame rate sampling is also the source of a potential micro-stutter at constant
speed.

Instead, QJoyControl maps the stick's up/down deflection to keyboard keys (`ArrowUp` /
`ArrowDown`), exactly as it already maps the buttons. Held keys give clean, flicker-free
direction state.

## Design

### Input model

- QJoyControl configuration: bind stick-up → `ArrowUp`, stick-down → `ArrowDown` (with the
  app's own threshold), alongside the existing button→key bindings.
- A single key-driven `InputSource` reports:
  - `stick.y = (upHeld ? 1 : 0) - (downHeld ? 1 : 0)` → one of `-1`, `0`, `+1`
  - `buttons` from `CONFIG.keyMap` (unchanged)
- `ScrollEngine` is **unchanged**. `applyDeadzone(1, 0.08) === 1`, so `deflection * maxSpeed`
  with `stick.y ∈ {-1, 0, 1}` already yields exactly `±maxSpeed` or `0`. The binary feel
  comes entirely from the input being quantized to `{-1, 0, 1}`.

### Collapse to one input source

The mouse capture was the only thing that made `QJoyControlInputSource` distinct from
`KeyboardInputSource`. With it gone, both sources are identical key→frame mappers, so they
collapse into one. Today's `KeyboardInputSource` already implements the target behavior
(`ArrowUp/Down → stick.y ±1`, keyMap → buttons); it becomes the sole source, with one
hardening fix (below).

### Files

**Deleted:**
- `src/input/mouseRateToStick.ts` and `src/input/mouseRateToStick.test.ts`
- `src/input/QJoyControlInputSource.ts` (Pointer Lock, mouse accumulation, `engage()`)

**Changed:**
- `src/input/KeyboardInputSource.ts` → rename to `src/input/KeyInputSource.ts` (sole input
  source; no longer dev-only — update the file's header comment). Track `ArrowUp` and
  `ArrowDown` held-state independently and compute `stick.y = (upHeld?1:0) - (downHeld?1:0)`,
  so releasing one arrow while the other is held resolves to the remaining direction rather
  than `0`.
- `src/input/InputSource.ts` — remove `isConnected()` from the interface. With the HUD
  indicator gone it has no consumer, and it can no longer reflect reality (see Hud.ts below).
  Drop it from the source implementation too.
- `src/main.ts` — remove the `?input=keyboard` branching, the scroller click-to-engage
  handler, and the `engage` plumbing. Always construct the single `KeyInputSource`. Remove
  `connected` from the HUD model passed to `hud.update`.
- `src/hud/Hud.ts` — remove the "Controller ● / Click to engage ○" HUD item and the
  `connected` field from `HudModel`. It can no longer reflect reality (QJoyControl keystrokes
  are indistinguishable from a real keyboard, and there is no engage step).
- `src/config.ts` — remove `mouseFullThrottleRate` and `invertThrottle` (mouse-only). Keep
  `deadzone` and all other tunables. `keyMap` unchanged; the throttle keys (`ArrowUp` /
  `ArrowDown`) are handled directly by the input source, not via `keyMap`.

**Docs:**
- `QJOYCONTROL-SETUP.md` — remove the "enable Left analog mouse", "click to engage Pointer
  Lock", and "Esc to release" instructions. Add stick-up → `↑` and stick-down → `↓` to the
  button-to-key mapping table. Update the "Use it" steps (no engage ritual).
- `README.md` — update the overview (stick is now binary forward/reverse at max speed, no
  Pointer Lock), the keyboard-keys table, and the Controls table (Stick ▲/▼ = forward/reverse
  at max speed).

### Testing

- Delete `mouseRateToStick.test.ts`.
- `ScrollEngine` tests unchanged and still pass.
- Add a unit test for the sole input source's key handling: `ArrowUp` → `stick.y === 1`,
  `ArrowDown` → `stick.y === -1`, neither → `0`, and the both-held / release-one edge case
  resolving to the remaining direction.

## Out of scope

- Native Gamepad API / WebHID reading of the JoyCon (considered; rejected due to inconsistent
  JoyCon Bluetooth mapping, which QJoyControl exists to avoid).
- Any acceleration/ramp on the binary throttle — motion is an instant on/off at `maxSpeed`.
- Changes to cruise, seek, text-size, or max-speed controls.
