# Mirror-Screen Toggle (Capture Button)

## Problem

The teleprompter is used with a beam-splitter mirror, which reflects the screen
left-to-right. The script therefore needs to be horizontally flipped so it reads
correctly in the mirror. The user wants the JoyCon's **Capture** button to toggle this
mirroring.

## Goal

Pressing the Capture button flips the entire screen horizontally (mirror image) and
pressing it again flips it back. Session-only — resets to un-mirrored on reload.

## Design

### Data path

The Capture button reuses the existing button pipeline end to end:

`decodeButtons` (JoyCon `0x30` report) → `ButtonState.capture` → `ControlMapper` edge
detection → `{ type: 'toggleMirror' }` `Command` → `main.ts` `applyCommand`. No new input
plumbing.

The Capture bit lives in the JoyCon's shared-button byte at WebHID offset `data[3]`, bit
`0x20` (the reportId is stripped by WebHID, shifting docs offsets down by one).

### Rendering

`main.ts` owns a session `let mirrored = false`. `applyCommand`'s `toggleMirror` case flips
it and calls `document.body.classList.toggle('mirrored', mirrored)`. CSS applies
`body.mirrored { transform: scaleX(-1); }`, flipping the whole page horizontally (text +
HUD + Connect button), which is what the user chose ("entire screen").

`scaleX(-1)` is a left↔right mirror (not a vertical flip) — the correct beam-splitter
correction. Browser hit-testing accounts for the transform, so the Connect button and the
HUD throttle toggle remain clickable while mirrored.

Note: a `transform` on `<body>` makes it the containing block for its `position: fixed`
descendants (`#scroller`, `#hud`, `#drop-zone`, `#connect-joycon`). Because `html, body`
are `height: 100%` with zero margin, `<body>` is viewport-sized, so `inset: 0` fixed
elements still cover the viewport — no layout change beyond the intended flip.

### Files

- **src/types.ts** — `ButtonState` gains `capture: boolean`; `NEUTRAL_FRAME.buttons` gains
  `capture: false`; `Command` gains `{ type: 'toggleMirror' }`.
- **src/input/joyconReport.ts** — `decodeButtons` additionally reads
  `capture: !!(data.getUint8(3) & 0x20)`; update its doc comment to mention the shared byte.
- **src/control/ControlMapper.ts** — add `if (pressed('capture')) cmds.push({ type: 'toggleMirror' });`.
- **src/config.ts** — `keyMap` gains `m: 'capture'` (keyboard fallback / dev trigger).
- **src/main.ts** — `let mirrored = false;` and an `applyCommand` `toggleMirror` case that
  flips it and toggles the `mirrored` body class.
- **src/styles.css** — `body.mirrored { transform: scaleX(-1); }`.
- **Docs** — `JOYCON-SETUP.md` controls list and `README.md` controls table: add
  "Capture — mirror the screen (for beam-splitter teleprompters)."

### No HUD indicator

The entire screen visibly flips, so a mirror-state readout would be redundant (YAGNI).

### Testing

- `joyconReport.test.ts` — add a case: shared byte `0x20` → `capture: true`; and update the
  existing "all-false" test's expected object to include `capture: false` (since
  `decodeButtons` now returns an 8th field).
- `ControlMapper.test.ts` — add: a Capture press edge emits `{ type: 'toggleMirror' }`.
- The `main.ts` CSS-class toggle is thin wiring (not unit-tested); verified hands-on.
- **Manual on-device check:** confirm the Capture button actually reports over WebHID on the
  user's setup (some JoyCon system buttons can be OS-intercepted) — the one hands-on step,
  like the earlier stick-direction verification.

## Out of scope

- Persistence across reloads (session-only by decision).
- Vertical flip / rotation (only the horizontal mirror is needed for a beam splitter).
- A HUD indicator for mirror state.
- Mirroring only a subset of the screen (the choice is whole-screen).
