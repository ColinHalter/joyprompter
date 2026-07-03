# JoyCon Teleprompter — Design

**Date:** 2026-07-03
**Status:** Approved design. Input pathway revised 2026-07-03 to use QJoyControl
out-of-the-box (no code changes) — see "Revision" note below.

## Revision note (input pathway)

The original design delivered JoyCon input to the browser via a **WebSocket bridge
added to QJoyControl** (a C++/Qt code change). That approach is **superseded**.
QJoyControl is now treated as reference-only and is **not modified**. Instead, the
teleprompter consumes QJoyControl's **existing out-of-the-box output**: its
"Left analog stick → mouse movement" feature (the proportional throttle) and its
"button → keyboard key" mapping (the discrete controls). The browser captures the
stick-as-mouse via the **Pointer Lock API** and the buttons as key presses. All
teleprompter logic and the web app modules are unchanged; only the input source
differs.

## Summary

A browser-based teleprompter driven by a Nintendo Switch Left JoyCon. The user
loads a PDF, and the app reflows its text as large teleprompter type that scrolls
vertically. A Left JoyCon (held vertically) controls scrolling speed, direction,
cruise, text size, and paragraph seeking. JoyCon input reaches the browser through
the **unmodified QJoyControl** app: the analog stick drives mouse movement (captured
by the browser via Pointer Lock and interpreted as a proportional throttle), and the
buttons are mapped to keyboard keys the app listens for.

## Goals

- Load a local PDF and display its text as scrolling teleprompter copy.
- Proportional "throttle" scroll control from the analog stick (a little push =
  slow, full push = fast; up = forward, down = reverse).
- Hands-free cruise mode at a settable max speed.
- Adjust text size and seek by paragraph from the controller.
- Keep the PDF entirely local (no upload, works offline).
- **Require no changes to QJoyControl** — work with its out-of-the-box features.

## Non-Goals (YAGNI)

- No preserved PDF layout/images/fonts — text is extracted and reflowed.
- No changes to QJoyControl source (no WebSocket bridge, no custom build).
- No hosted server, script library, or multi-file management.
- No support for controllers other than a single Left JoyCon (initially).
- No OCR of image-only/scanned PDFs.
- No mirroring/flip for reflective-glass teleprompter rigs (can be added later).

## Architecture

Two independent pieces on the same machine. QJoyControl is unmodified; the browser
app consumes its OS-level output.

```
                          ┌─ stick → OS mouse movement ─┐  (Pointer Lock: movementY → throttle)
Left JoyCon ── QJoyControl ┤                             ├─→ Teleprompter (browser)
   (BT HID)   (unmodified) └─ buttons → OS key presses ──┘  (keydown/keyup → controls)
```

1. **QJoyControl (unmodified, configured by the user):**
   - "Left analog mouse" enabled → the analog stick moves the OS mouse cursor at a
     speed proportional to deflection.
   - Button-to-key mapping configured so the Left JoyCon's D-pad, SL, SR, and
     stick-click emit the specific keys the teleprompter listens for.

2. **Teleprompter web app (browser, static, no backend):**
   - **Pointer Lock** captures the stick-as-mouse: while locked, the page receives
     unbounded relative `movementY` deltas (cursor hidden, never stops at screen
     edges). The movement **rate** (px/s) is normalized into a throttle value.
   - **keydown/keyup** on the mapped keys drive the discrete controls.
   - Everything downstream (throttle math, state machine, PDF reflow, HUD) is the
     same as before.

## Component 1 — QJoyControl configuration (no code)

The user sets this up once in QJoyControl:

- Enable **Left analog mouse** (stick → mouse movement). Tune the analog sensitivity
  slider so a full stick push produces a comfortably fast cursor motion.
- Disable gyro mouse (so only the stick drives movement).
- Map buttons to these keys (the keys the teleprompter listens for by default; all
  configurable in the app's `CONFIG.keyMap`):

  | Left JoyCon input | Key | Teleprompter action |
  |-------------------|-----|---------------------|
  | D-pad Up          | `i` | Text size up        |
  | D-pad Down        | `k` | Text size down      |
  | D-pad Left        | `j` | Seek back one paragraph |
  | D-pad Right       | `l` | Seek forward one paragraph |
  | SL                | `q` | Decrease max speed  |
  | SR                | `e` | Increase max speed  |
  | Stick click       | `c` | Toggle cruise       |

A copy of this table ships as an in-repo setup guide (`teleprompter/QJOYCONTROL-SETUP.md`).

## Component 2 — Teleprompter web app

### Stack (unchanged)

Plain TypeScript + PDF.js, bundled with Vite; Vitest for unit tests.

### Modules

All existing modules are reused **unchanged**: `ScrollEngine`, `throttle`
(`applyDeadzone`), `ControlMapper`, `DocumentView`, `paragraphs`, `Hud`, and the
`InputSource` interface. The input layer changes:

- **Removed:** `WebSocketInputSource` and `parseFrame` (+ its test) — the WebSocket
  pathway is gone.
- **New — `mouseRateToStick(accumulatedMovementY, dtSeconds, fullThrottleRate)`**
  (pure, tested): converts accumulated pointer-lock vertical movement over a frame
  into a normalized stick value in −1..1. Up-movement (negative `movementY`) →
  positive stick (forward); rate at/above `fullThrottleRate` clamps to ±1.
- **New — `QJoyControlInputSource implements InputSource`:** the default live source.
  - Requests/tracks **Pointer Lock** on the scroller element.
  - Accumulates `movementY` from `mousemove` events while locked.
  - On each `getFrame()`, computes the movement rate since the last frame (using
    `performance.now()`), converts it via `mouseRateToStick` into `stick.y`, and
    resets the accumulator (no movement this frame → rate 0 → HOLD).
  - `keydown`/`keyup` on `CONFIG.keyMap` keys set the `ButtonState` fields.
  - `isConnected()` returns whether Pointer Lock is currently engaged.
- **Kept — `KeyboardInputSource`** for hardware-free dev/testing (`?input=keyboard`),
  with arrow keys simulating the stick.

### Control mapping (Left JoyCon, held vertically)

| Input        | Path                          | Action                                   |
|--------------|-------------------------------|------------------------------------------|
| Stick ▲ / ▼  | stick → mouse → Pointer Lock  | Throttle: proportional scroll (up=fwd)   |
| Stick click  | mapped key `c` → keydown      | Toggle cruise (hands-free at max speed)  |
| D-pad ▲ / ▼  | keys `i` / `k`                | Text size up / down                      |
| D-pad ◀ / ▶  | keys `j` / `l`                | Seek back / forward one paragraph        |
| SL / SR      | keys `q` / `e`                | Decrease / increase max scroll speed     |

### Throttle → scroll model (unchanged, rate-fed)

1. **Rate as throttle:** the Pointer-Lock mouse-movement rate (px/s) is normalized to
   a stick value in −1..1 (`mouseRateToStick`), then fed to the existing
   `ScrollEngine`. Holding the stick produces a steady mouse rate → steady speed.
2. **Deadzone** ignores small jitter (may be slightly larger than for a raw stick to
   absorb mouse noise; `CONFIG.deadzone`).
3. **Max-speed ceiling** set by SL/SR (`stepMaxSpeed`), clamped to a sensible range.
4. **Direction:** up = forward, down = reverse.
5. **Calibration:** `CONFIG.mouseFullThrottleRate` (px/s that maps to full throttle)
   is tuned together with QJoyControl's analog sensitivity. Optional
   `CONFIG.invertThrottle` handles a flipped Y axis.

### Scroll state machine (unchanged)

Three states — HOLD, MANUAL, CRUISE:
- HOLD/MANUAL + stick-click (`c`) → CRUISE (auto-scroll at max speed).
- CRUISE + stick-click → HOLD (pause, keeps place).
- CRUISE + stick moved (throttle ≠ 0) → MANUAL (take over).
- MANUAL + stick centered (throttle 0) → HOLD.

## Error handling & edge cases

- **Pointer Lock not engaged / lost (Esc):** HUD shows "Click to engage controller";
  throttle reads 0 (no runaway). Clicking the scroller re-engages.
- **QJoyControl not running / not configured:** no key or mouse input arrives; the
  app simply sits idle (HUD shows not engaged). No error state needed.
- **PDF with no extractable text:** shows "No selectable text found in this PDF."
- **Invalid / non-PDF file:** shows an error and re-shows the drop zone.
- **Scroll bounds:** clamp at top; auto-stop at bottom (cruise ends at the end).
- **Font-size / max-speed limits:** clamped to sensible ranges.
- **Held buttons:** edge detection fires D-pad size/seek and cruise once per key press.

## Testing

- **Pure logic (Vitest):** `applyDeadzone`, `ScrollEngine` state machine,
  `ControlMapper` edge detection, `paragraphs` (extract/seek), and the new
  `mouseRateToStick` (sign, normalization, clamping, dt=0 guard). Highest value.
- **`KeyboardInputSource`:** exercise the whole app end-to-end with no hardware.
- **`QJoyControlInputSource`:** DOM/Pointer-Lock parts verified via manual test; the
  rate math is covered by `mouseRateToStick` tests.
- **`DocumentView`:** text extraction/reflow against small fixture PDFs (one normal,
  one image-only for the no-text path).
- **Integration smoke test (manual, with hardware):** configure QJoyControl per the
  setup guide, open the app, engage Pointer Lock, and confirm throttle, cruise, size,
  seek, and max-speed with a real Left JoyCon.

## Open items for implementation

- Exact `mouseFullThrottleRate` default and deadzone size (tune by feel alongside
  QJoyControl sensitivity).
- Whether D-pad size/seek auto-repeat when the key is held.
- Whether to add a slight non-linear throttle curve.
