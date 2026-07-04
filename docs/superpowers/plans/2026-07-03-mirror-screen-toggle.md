# Mirror-Screen Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toggle a horizontal (left↔right) mirror of the whole screen with the JoyCon's Capture button, for beam-splitter teleprompter use. Session-only.

**Architecture:** The Capture button flows through the existing input pipeline (`decodeButtons` → `ButtonState.capture` → `ControlMapper` edge → a new `toggleMirror` `Command` → `main.ts`), which flips a `mirrored` class on `<body>` that applies `transform: scaleX(-1)`.

**Tech Stack:** TypeScript · Vite · Vitest (jsdom, globals) · WebHID

**Design doc:** [docs/superpowers/specs/2026-07-03-mirror-screen-toggle-design.md](../specs/2026-07-03-mirror-screen-toggle-design.md)

---

## File overview

- `src/types.ts` — `ButtonState` gains `capture`; `NEUTRAL_FRAME` gains it; `Command` gains `{ type: 'toggleMirror' }`.
- `src/input/joyconReport.ts` + `.test.ts` — `decodeButtons` reads the Capture bit (shared byte `data[3]` bit `0x20`).
- `src/control/ControlMapper.ts` + `.test.ts` — a Capture press emits `toggleMirror`.
- `src/config.ts` — keyMap `m: 'capture'` (keyboard fallback).
- `src/main.ts` — `mirrored` state + `applyCommand` case toggling the body class.
- `src/styles.css` — `body.mirrored { transform: scaleX(-1); }`.
- `JOYCON-SETUP.md`, `README.md` — controls docs.

Offsets note: WebHID delivers the `0x30` report with the reportId stripped, so the left-button byte is `data[4]` and the shared-button byte (containing Capture) is `data[3]`.

---

## Task 1: Add the Capture button to the input model and decoder (TDD)

**Files:**
- Modify: `src/types.ts`
- Modify: `src/input/joyconReport.ts`
- Test: `src/input/joyconReport.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/input/joyconReport.test.ts`, replace the `report` helper and the `decodeButtons` describe block. Replace:

```ts
/** Build a synthetic 0x30 report body (reportId already stripped, as WebHID delivers it). */
function report({ buttons = 0, vertical = STICK_CENTER }: { buttons?: number; vertical?: number }): DataView {
  const bytes = new Uint8Array(12);
  bytes[4] = buttons; // left-button byte
  bytes[6] = (vertical & 0x0f) << 4; // stick low nibble -> high nibble of byte 6
  bytes[7] = (vertical >> 4) & 0xff;  // stick high 8 bits
  return new DataView(bytes.buffer);
}

describe('decodeButtons', () => {
  it('maps each left-JoyCon button bit to its ButtonState field', () => {
    expect(decodeButtons(report({ buttons: 0x02 })).up).toBe(true);
    expect(decodeButtons(report({ buttons: 0x01 })).down).toBe(true);
    expect(decodeButtons(report({ buttons: 0x04 })).right).toBe(true);
    expect(decodeButtons(report({ buttons: 0x08 })).left).toBe(true);
    expect(decodeButtons(report({ buttons: 0x10 })).sr).toBe(true);
    expect(decodeButtons(report({ buttons: 0x20 })).sl).toBe(true);
    expect(decodeButtons(report({ buttons: 0x80 })).zl).toBe(true);
  });
  it('reports all-false when no bits are set', () => {
    expect(decodeButtons(report({}))).toEqual({
      up: false, down: false, left: false, right: false, sl: false, sr: false, zl: false,
    });
  });
});
```

with:

```ts
/** Build a synthetic 0x30 report body (reportId already stripped, as WebHID delivers it). */
function report(
  { buttons = 0, shared = 0, vertical = STICK_CENTER }:
    { buttons?: number; shared?: number; vertical?: number },
): DataView {
  const bytes = new Uint8Array(12);
  bytes[3] = shared;  // shared-button byte (Minus/Capture/…)
  bytes[4] = buttons; // left-button byte
  bytes[6] = (vertical & 0x0f) << 4; // stick low nibble -> high nibble of byte 6
  bytes[7] = (vertical >> 4) & 0xff;  // stick high 8 bits
  return new DataView(bytes.buffer);
}

describe('decodeButtons', () => {
  it('maps each left-JoyCon button bit to its ButtonState field', () => {
    expect(decodeButtons(report({ buttons: 0x02 })).up).toBe(true);
    expect(decodeButtons(report({ buttons: 0x01 })).down).toBe(true);
    expect(decodeButtons(report({ buttons: 0x04 })).right).toBe(true);
    expect(decodeButtons(report({ buttons: 0x08 })).left).toBe(true);
    expect(decodeButtons(report({ buttons: 0x10 })).sr).toBe(true);
    expect(decodeButtons(report({ buttons: 0x20 })).sl).toBe(true);
    expect(decodeButtons(report({ buttons: 0x80 })).zl).toBe(true);
  });
  it('maps the Capture bit from the shared-button byte', () => {
    expect(decodeButtons(report({ shared: 0x20 })).capture).toBe(true);
    expect(decodeButtons(report({ buttons: 0x02 })).capture).toBe(false);
  });
  it('reports all-false when no bits are set', () => {
    expect(decodeButtons(report({}))).toEqual({
      up: false, down: false, left: false, right: false, sl: false, sr: false, zl: false,
      capture: false,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/input/joyconReport.test.ts`
Expected: FAIL — `.capture` is `undefined` (decoder doesn't produce it) and the all-false `toEqual` mismatches.

- [ ] **Step 3: Add `capture` and `toggleMirror` to the type model**

In `src/types.ts`, replace:

```ts
export interface ButtonState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  sl: boolean;
  sr: boolean;
  zl: boolean;
}
```

with:

```ts
export interface ButtonState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  sl: boolean;
  sr: boolean;
  zl: boolean;
  capture: boolean;
}
```

Then replace:

```ts
export type Command =
  | { type: 'toggleCruise' }
  | { type: 'sizeStep'; delta: 1 | -1 }
  | { type: 'seek'; delta: 1 | -1 }
  | { type: 'maxSpeedStep'; delta: 1 | -1 };
```

with:

```ts
export type Command =
  | { type: 'toggleCruise' }
  | { type: 'toggleMirror' }
  | { type: 'sizeStep'; delta: 1 | -1 }
  | { type: 'seek'; delta: 1 | -1 }
  | { type: 'maxSpeedStep'; delta: 1 | -1 };
```

Then replace:

```ts
  buttons: {
    up: false, down: false, left: false, right: false,
    sl: false, sr: false, zl: false,
  },
```

with:

```ts
  buttons: {
    up: false, down: false, left: false, right: false,
    sl: false, sr: false, zl: false, capture: false,
  },
```

- [ ] **Step 4: Decode the Capture bit**

In `src/input/joyconReport.ts`, replace:

```ts
/**
 * Decode the Left JoyCon buttons from a standard full-mode (0x30) report.
 * WebHID strips the reportId, so the left-button byte is at index 4.
 */
export function decodeButtons(data: DataView): ButtonState {
  const b = data.getUint8(4);
  return {
    down: !!(b & 0x01),
    up: !!(b & 0x02),
    right: !!(b & 0x04),
    left: !!(b & 0x08),
    sr: !!(b & 0x10),
    sl: !!(b & 0x20),
    zl: !!(b & 0x80),
  };
}
```

with:

```ts
/**
 * Decode the Left JoyCon buttons from a standard full-mode (0x30) report.
 * WebHID strips the reportId, so the left-button byte is at index 4 and the
 * shared-button byte (which holds Capture) is at index 3.
 */
export function decodeButtons(data: DataView): ButtonState {
  const b = data.getUint8(4);
  const shared = data.getUint8(3);
  return {
    down: !!(b & 0x01),
    up: !!(b & 0x02),
    right: !!(b & 0x04),
    left: !!(b & 0x08),
    sr: !!(b & 0x10),
    sl: !!(b & 0x20),
    zl: !!(b & 0x80),
    capture: !!(shared & 0x20),
  };
}
```

- [ ] **Step 5: Run tests and type-check**

Run: `npx vitest run src/input/joyconReport.test.ts`
Expected: PASS (including the new Capture cases).

Run: `npm test`
Expected: full suite PASS.

Run: `npx tsc --noEmit -p tsconfig.build.json`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/input/joyconReport.ts src/input/joyconReport.test.ts
git commit -m "feat: decode the JoyCon Capture button"
```

---

## Task 2: Map Capture → toggleMirror in ControlMapper (TDD)

**Files:**
- Modify: `src/control/ControlMapper.ts`
- Test: `src/control/ControlMapper.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/control/ControlMapper.test.ts`, add this test inside the `describe('ControlMapper', ...)` block, immediately after the `'emits toggleCruise on a ZL press edge'` test:

```ts
  it('emits toggleMirror on a Capture press edge', () => {
    const m = new ControlMapper();
    expect(m.update(frameWith({ capture: true }))).toEqual([{ type: 'toggleMirror' }]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/control/ControlMapper.test.ts`
Expected: FAIL — mapper returns `[]` (no `toggleMirror` emitted yet).

- [ ] **Step 3: Emit toggleMirror on the Capture edge**

In `src/control/ControlMapper.ts`, replace:

```ts
    if (pressed('zl')) cmds.push({ type: 'toggleCruise' });
```

with:

```ts
    if (pressed('zl')) cmds.push({ type: 'toggleCruise' });
    if (pressed('capture')) cmds.push({ type: 'toggleMirror' });
```

- [ ] **Step 4: Run tests and type-check**

Run: `npx vitest run src/control/ControlMapper.test.ts`
Expected: PASS.

Run: `npm test`
Expected: full suite PASS.

Run: `npx tsc --noEmit -p tsconfig.build.json`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/control/ControlMapper.ts src/control/ControlMapper.test.ts
git commit -m "feat: map JoyCon Capture press to a toggleMirror command"
```

---

## Task 3: Wire the mirror toggle, keyboard key, and CSS

**Files:**
- Modify: `src/config.ts`
- Modify: `src/main.ts`
- Modify: `src/styles.css`

Wiring + CSS; the behavior is verified by the full suite still passing, tsc, build, and the manual step in Task 5.

- [ ] **Step 1: Add the keyboard-fallback key**

In `src/config.ts`, replace:

```ts
    z: 'zl',      // ZL          -> toggle cruise
  } as Record<string, keyof ButtonState>,
```

with:

```ts
    z: 'zl',      // ZL          -> toggle cruise
    m: 'capture', // Capture     -> mirror the screen
  } as Record<string, keyof ButtonState>,
```

- [ ] **Step 2: Add the `mirrored` state to main.ts**

In `src/main.ts`, replace:

```ts
let fontSize = CONFIG.initialFontSize;
view.setFontSize(fontSize);
```

with:

```ts
let fontSize = CONFIG.initialFontSize;
view.setFontSize(fontSize);

let mirrored = false;
```

- [ ] **Step 3: Handle toggleMirror in applyCommand**

In `src/main.ts`, replace:

```ts
    case 'toggleCruise':
      engine.toggleCruise();
      break;
```

with:

```ts
    case 'toggleCruise':
      engine.toggleCruise();
      break;
    case 'toggleMirror':
      mirrored = !mirrored;
      document.body.classList.toggle('mirrored', mirrored);
      break;
```

- [ ] **Step 4: Add the mirror CSS**

In `src/styles.css`, append at the end of the file:

```css

body.mirrored { transform: scaleX(-1); }
```

- [ ] **Step 5: Type-check, test, build**

Run: `npx tsc --noEmit -p tsconfig.build.json`
Expected: exit 0.

Run: `npm test`
Expected: full suite PASS.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/config.ts src/main.ts src/styles.css
git commit -m "feat: toggle whole-screen mirror on the Capture command"
```

---

## Task 4: Documentation

**Files:**
- Modify: `JOYCON-SETUP.md`
- Modify: `README.md`

Docs-only.

- [ ] **Step 1: JOYCON-SETUP.md controls list**

In `JOYCON-SETUP.md`, replace:

```markdown
- **ZL** — toggle cruise (hands-free scroll at the max speed).
- **D-pad up / down** — increase / decrease max scroll speed.
```

with:

```markdown
- **ZL** — toggle cruise (hands-free scroll at the max speed).
- **Capture** — mirror the screen left-to-right (for a beam-splitter teleprompter).
- **D-pad up / down** — increase / decrease max scroll speed.
```

- [ ] **Step 2: README.md controls table**

In `README.md`, replace:

```markdown
| ZL           | Toggle cruise (hands-free at max speed)        |
| D-pad ▲ / ▼  | Increase / decrease max scroll speed           |
```

with:

```markdown
| ZL           | Toggle cruise (hands-free at max speed)        |
| Capture      | Mirror the screen left-to-right (beam-splitter) |
| D-pad ▲ / ▼  | Increase / decrease max scroll speed           |
```

- [ ] **Step 3: README.md keyboard table**

In `README.md`, replace:

```markdown
| `q` / `e`   | Text size down / up                    |
```

with:

```markdown
| `q` / `e`   | Text size down / up                    |
| `m`         | Mirror the screen                      |
```

- [ ] **Step 4: Verify and commit**

Run: `npm test`
Expected: full suite PASS (docs-only; nothing breaks).

```bash
git add JOYCON-SETUP.md README.md
git commit -m "docs: document the Capture-button screen mirror"
```

---

## Task 5: On-device verification (manual — human in the loop)

**Cannot be done by a subagent.** Needs the physical JoyCon and a Chromium browser. The controller should pause here and run it with the user.

- [ ] **Step 1: Launch and connect**

Run `npm run dev`, open the printed URL in Chrome/Edge, load a PDF, and connect the JoyCon (HUD shows "Joy-Con ●").

- [ ] **Step 2: Verify Capture mirrors the screen**

Press the **Capture** button (the square button below the screenshot/− area on the Left JoyCon). Confirm the whole screen flips left-to-right (text reads mirrored on the direct screen, correct in the beam-splitter). Press again to flip back.

- [ ] **Step 3: If Capture does not register**

Some setups may have the Capture button intercepted by the OS or reported differently. If pressing it does nothing:
- In the browser console, log `navigator.hid` input reports or add a temporary `console.log(e.data.getUint8(3).toString(2))` in `JoyConHidInputSource.onInputReport` to see which bit changes when Capture is pressed, and adjust the mask in `decodeButtons` accordingly.
- Fall back to the keyboard: press `m` to confirm the mirror wiring itself works independent of the button.
Report findings; no commit unless the mask needs correcting.

---

## Notes

- **Session-only** — `mirrored` starts `false` each load; no persistence (by design).
- **`scaleX(-1)` on `<body>`** is a left↔right mirror. Because `html, body` are `height: 100%` with no margin, `<body>` is viewport-sized, so the transform doesn't disturb the `position: fixed` layout beyond the intended flip, and hit-testing still routes clicks correctly (Connect button, HUD toggle keep working while mirrored).
- **ScrollEngine / DocumentView / the throttle path are untouched.**
- **`.DS_Store`** may be present untracked; never stage it — use the explicit `git add` lists above.
