# QJoyControl-Compatible Input Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Source control note:** Do NOT run any git commands for this project until the user explicitly asks. Skip all "Commit" steps (there are none below). Complete every code/test/build step normally.

**Goal:** Make the existing teleprompter web app driven by an **unmodified** QJoyControl, using its out-of-the-box output: the analog-stick-as-mouse-movement (captured via the browser Pointer Lock API and interpreted as a proportional throttle) and button-to-key mappings (captured as key presses).

**Architecture:** Replace the WebSocket input pathway with a `QJoyControlInputSource`. It captures Pointer-Lock `movementY`, converts the movement **rate** into a normalized stick value via a pure `mouseRateToStick` helper, and reads mapped keys into the button state. Everything downstream (`ScrollEngine`, `ControlMapper`, `DocumentView`, `Hud`, `paragraphs`, `throttle`) is unchanged.

**Tech Stack:** TypeScript, Vite, Vitest, pdfjs-dist (all already set up).

**Working directory:** `/Users/chalter/CODE/prompter/teleprompter`. Paths below are relative to it. This is the app built by `2026-07-03-teleprompter-web-app.md`; it already exists and its tests pass.

**Context — what already exists and stays unchanged:**
- `src/types.ts` — `InputFrame`, `ButtonState`, `NEUTRAL_FRAME`, etc.
- `src/input/InputSource.ts` — `interface InputSource { getFrame(): InputFrame; isConnected(): boolean; start(): void; stop(): void; }`
- `src/input/KeyboardInputSource.ts` — dev/test source (arrow keys = stick).
- `src/scroll/ScrollEngine.ts`, `src/scroll/throttle.ts`, `src/control/ControlMapper.ts`, `src/document/DocumentView.ts`, `src/document/paragraphs.ts`, `src/hud/Hud.ts` — reused as-is.
- `src/main.ts` — currently defaults to a WebSocket source; will be re-pointed.
- **To be removed:** `src/input/WebSocketInputSource.ts`, `src/input/parseFrame.ts`, `src/input/parseFrame.test.ts`.

---

## File Structure

- `src/config.ts` — remove `wsUrl`/`reconnectDelayMs`; add `mouseFullThrottleRate`, `invertThrottle`, `keyMap` (modified)
- `src/input/WebSocketInputSource.ts`, `src/input/parseFrame.ts`, `src/input/parseFrame.test.ts` — deleted
- `src/input/mouseRateToStick.ts` + `mouseRateToStick.test.ts` — pure rate→stick helper (new, TDD)
- `src/input/QJoyControlInputSource.ts` — Pointer-Lock + mapped-keys source (new)
- `src/input/KeyboardInputSource.ts` — updated to share `CONFIG.keyMap` for buttons (modified)
- `src/main.ts` — select `QJoyControlInputSource` by default; wire click-to-engage Pointer Lock (modified)
- `src/hud/Hud.ts` — disconnected label reads "Click to engage" (small modified)
- `QJOYCONTROL-SETUP.md` — user setup guide (new)

---

## Task 1: Config changes + remove the WebSocket pathway

**Files:**
- Modify: `src/config.ts`
- Delete: `src/input/WebSocketInputSource.ts`, `src/input/parseFrame.ts`, `src/input/parseFrame.test.ts`

- [ ] **Step 1: Replace `src/config.ts` with this content**

```ts
import type { ButtonState } from './types';

export const CONFIG = {
  // Throttle (stick-as-mouse via Pointer Lock)
  mouseFullThrottleRate: 1200, // px/s of mouse movement that maps to full throttle
  invertThrottle: false,       // flip if QJoyControl's mouse Y is inverted
  deadzone: 0.08,
  minMaxSpeed: 20,    // px/s
  maxMaxSpeed: 1500,  // px/s
  maxSpeedStep: 60,   // px/s per SL/SR press
  initialMaxSpeed: 300,
  // Text
  minFontSize: 16,    // px
  maxFontSize: 160,   // px
  fontSizeStep: 4,    // px per D-pad up/down press
  initialFontSize: 48,
  // HUD
  hudHideMs: 2500,
  // Keys the app listens for (map QJoyControl buttons to these).
  keyMap: {
    i: 'up',         // D-pad up    -> text size up
    k: 'down',       // D-pad down  -> text size down
    j: 'left',       // D-pad left  -> seek back
    l: 'right',      // D-pad right -> seek forward
    q: 'sl',         // SL          -> max speed down
    e: 'sr',         // SR          -> max speed up
    c: 'stickClick', // stick click -> toggle cruise
  } as Record<string, keyof ButtonState>,
};
```

- [ ] **Step 2: Delete the WebSocket pathway files**

Run:
```bash
rm src/input/WebSocketInputSource.ts src/input/parseFrame.ts src/input/parseFrame.test.ts
```

- [ ] **Step 3: Confirm nothing still references the removed files**

Run: `grep -rn "WebSocketInputSource\|parseFrame\|wsUrl\|reconnectDelayMs" src`
Expected: only matches inside `src/main.ts` (which is fixed in Task 4). If there are others, note them. (After Task 4 this grep must return nothing.)

- [ ] **Step 4: Type-check (expect main.ts to still reference the old source until Task 4)**

Run: `npx tsc --noEmit`
Expected: errors ONLY in `src/main.ts` about the missing `WebSocketInputSource` import. That is fine for now — Task 4 fixes it. (If there are errors elsewhere, investigate.)

---

## Task 2: `mouseRateToStick` pure helper (TDD)

**Files:**
- Create: `src/input/mouseRateToStick.ts`
- Test: `src/input/mouseRateToStick.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { mouseRateToStick } from './mouseRateToStick';

describe('mouseRateToStick', () => {
  const rate = 1000; // px/s at full throttle

  it('returns 0 when dt is 0 (no elapsed time)', () => {
    expect(mouseRateToStick(-50, 0, rate)).toBe(0);
  });

  it('returns 0 when fullThrottleRate is 0', () => {
    expect(mouseRateToStick(-50, 0.1, 0)).toBe(0);
  });

  it('maps upward movement (negative movementY) to forward (positive stick)', () => {
    // moved -1000px over 1s => rate -1000 => stick +1
    expect(mouseRateToStick(-1000, 1, rate)).toBeCloseTo(1, 5);
  });

  it('maps downward movement to reverse (negative stick)', () => {
    expect(mouseRateToStick(1000, 1, rate)).toBeCloseTo(-1, 5);
  });

  it('is proportional below full throttle', () => {
    // -500px over 1s => rate -500 => stick +0.5
    expect(mouseRateToStick(-500, 1, rate)).toBeCloseTo(0.5, 5);
  });

  it('clamps to [-1, 1] above full throttle', () => {
    expect(mouseRateToStick(-5000, 1, rate)).toBe(1);
    expect(mouseRateToStick(5000, 1, rate)).toBe(-1);
  });

  it('honors invert', () => {
    expect(mouseRateToStick(-1000, 1, rate, true)).toBeCloseTo(-1, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- mouseRateToStick`
Expected: FAIL — module/function missing.

- [ ] **Step 3: Write the implementation**

```ts
// src/input/mouseRateToStick.ts

/**
 * Convert accumulated Pointer-Lock vertical mouse movement over a frame into a
 * normalized throttle value in [-1, 1].
 *
 * Screen Y grows downward, so moving the mouse UP yields negative movementY.
 * Up = scroll forward = positive stick, hence the leading minus sign.
 *
 * @param accumMovementY   summed event.movementY since the last frame (px)
 * @param dtSeconds        elapsed time since the last frame (s)
 * @param fullThrottleRate mouse rate (px/s) that corresponds to full throttle
 * @param invert           flip the sign if the mouse Y axis is inverted
 */
export function mouseRateToStick(
  accumMovementY: number,
  dtSeconds: number,
  fullThrottleRate: number,
  invert = false,
): number {
  if (dtSeconds <= 0 || fullThrottleRate <= 0) return 0;
  const rate = accumMovementY / dtSeconds; // px/s; negative = moving up
  let stick = -rate / fullThrottleRate;
  if (invert) stick = -stick;
  return Math.max(-1, Math.min(1, stick));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- mouseRateToStick`
Expected: PASS (7 tests).

---

## Task 3: `QJoyControlInputSource` + share the key map in `KeyboardInputSource`

**Files:**
- Create: `src/input/QJoyControlInputSource.ts`
- Modify: `src/input/KeyboardInputSource.ts`

- [ ] **Step 1: Create `src/input/QJoyControlInputSource.ts`**

```ts
import type { InputFrame, ButtonState } from '../types';
import { NEUTRAL_FRAME } from '../types';
import type { InputSource } from './InputSource';
import { CONFIG } from '../config';
import { mouseRateToStick } from './mouseRateToStick';

/**
 * Live input from an unmodified QJoyControl:
 * - the analog stick drives OS mouse movement, captured here via Pointer Lock and
 *   converted (by rate) into a proportional throttle on stick.y;
 * - JoyCon buttons are mapped (in QJoyControl) to the keys in CONFIG.keyMap.
 */
export class QJoyControlInputSource implements InputSource {
  private frame: InputFrame = structuredClone(NEUTRAL_FRAME);
  private accumY = 0;
  private lastSample: number | null = null;

  constructor(private target: HTMLElement) {}

  private onMouseMove = (e: MouseEvent): void => {
    if (document.pointerLockElement === this.target) {
      this.accumY += e.movementY;
    }
  };
  private onKeyDown = (e: KeyboardEvent): void => this.setKey(e.key, true);
  private onKeyUp = (e: KeyboardEvent): void => this.setKey(e.key, false);

  getFrame(): InputFrame {
    const now = performance.now();
    const dt = this.lastSample === null ? 0 : (now - this.lastSample) / 1000;
    this.lastSample = now;
    this.frame.stick.y = mouseRateToStick(
      this.accumY, dt, CONFIG.mouseFullThrottleRate, CONFIG.invertThrottle,
    );
    this.frame.stick.x = 0;
    this.accumY = 0;
    return this.frame;
  }

  isConnected(): boolean {
    return document.pointerLockElement === this.target;
  }

  start(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mousemove', this.onMouseMove);
  }

  stop(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('mousemove', this.onMouseMove);
  }

  /** Request Pointer Lock. MUST be called from a user gesture (e.g. a click). */
  engage(): void {
    void this.target.requestPointerLock();
  }

  private setKey(key: string, down: boolean): void {
    const btn: keyof ButtonState | undefined = CONFIG.keyMap[key];
    if (btn) this.frame.buttons[btn] = down;
  }
}
```

- [ ] **Step 2: Update `src/input/KeyboardInputSource.ts` to share `CONFIG.keyMap`**

Replace the whole file with this (arrow keys still simulate the stick; buttons now use the same keys as the real controller, from `CONFIG.keyMap`):

```ts
import type { InputFrame, ButtonState } from '../types';
import { NEUTRAL_FRAME } from '../types';
import type { InputSource } from './InputSource';
import { CONFIG } from '../config';

/**
 * Hardware-free dev/testing source. Arrow Up/Down simulate the throttle stick;
 * the CONFIG.keyMap keys (i/k/j/l/q/e/c by default) simulate the buttons.
 */
export class KeyboardInputSource implements InputSource {
  private frame: InputFrame = structuredClone(NEUTRAL_FRAME);
  private onKeyDown = (e: KeyboardEvent) => this.setKey(e.key, true);
  private onKeyUp = (e: KeyboardEvent) => this.setKey(e.key, false);

  getFrame(): InputFrame {
    return this.frame;
  }

  isConnected(): boolean {
    return true;
  }

  start(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  stop(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  private setKey(key: string, down: boolean): void {
    if (key === 'ArrowUp') { this.frame.stick.y = down ? 1 : 0; return; }
    if (key === 'ArrowDown') { this.frame.stick.y = down ? -1 : 0; return; }
    const btn: keyof ButtonState | undefined = CONFIG.keyMap[key];
    if (btn) this.frame.buttons[btn] = down;
  }
}
```

- [ ] **Step 3: Type-check (still expect only main.ts errors)**

Run: `npx tsc --noEmit`
Expected: errors ONLY remain in `src/main.ts` (old WebSocket import). Fixed next task.

---

## Task 4: Wire `main.ts` (source selection + click-to-engage Pointer Lock)

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Update the input-source imports in `src/main.ts`**

Replace the line:
```ts
import { WebSocketInputSource } from './input/WebSocketInputSource';
```
with:
```ts
import { QJoyControlInputSource } from './input/QJoyControlInputSource';
```
(Keep the `KeyboardInputSource` import and the `import type { InputSource }` line.)

- [ ] **Step 2: Replace the source-selection block**

Replace:
```ts
const useKeyboard = new URLSearchParams(location.search).get('input') === 'keyboard';
const source: InputSource = useKeyboard
  ? new KeyboardInputSource()
  : new WebSocketInputSource();
source.start();
```
with:
```ts
const useKeyboard = new URLSearchParams(location.search).get('input') === 'keyboard';
let engage: (() => void) | null = null;
let source: InputSource;
if (useKeyboard) {
  source = new KeyboardInputSource();
} else {
  const qjc = new QJoyControlInputSource(scroller);
  source = qjc;
  engage = () => qjc.engage();
}
source.start();

// Click the scroller to engage Pointer Lock (captures the stick-as-mouse).
scroller.addEventListener('click', () => {
  if (engage && document.pointerLockElement !== scroller) engage();
});
```

- [ ] **Step 3: Verify the rest of `main.ts` is unchanged and consistent**

The rAF loop already does `const frame = source.getFrame();`, `engine.velocity(frame.stick.y)`, applies `mapper.update(frame)` commands, and calls `hud.update({ connected: source.isConnected(), ... })`. No other changes needed. Confirm by reading the file.

- [ ] **Step 4: Type-check and confirm the removed-refs grep is now clean**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `grep -rn "WebSocketInputSource\|parseFrame\|wsUrl\|reconnectDelayMs" src`
Expected: no matches.

---

## Task 5: HUD "Click to engage" label

**Files:**
- Modify: `src/hud/Hud.ts`

- [ ] **Step 1: Update the connection label in `Hud.update`**

In `src/hud/Hud.ts`, in the `update` method, change the first `<span>` (the connection indicator) from:
```ts
      <span class="hud-item ${m.connected ? 'ok' : 'bad'}">${m.connected ? 'Controller ●' : 'Disconnected ○'}</span>
```
to:
```ts
      <span class="hud-item ${m.connected ? 'ok' : 'bad'}">${m.connected ? 'Controller ●' : 'Click to engage ○'}</span>
```
(Do not change `stateLabel` or anything else — the existing `stateLabel` test must still pass.)

- [ ] **Step 2: Run the Hud test to confirm it still passes**

Run: `npm test -- Hud`
Expected: PASS (the `stateLabel` test is unaffected).

---

## Task 6: QJoyControl setup guide

**Files:**
- Create: `QJOYCONTROL-SETUP.md`

- [ ] **Step 1: Create `QJOYCONTROL-SETUP.md`**

```markdown
# Driving the teleprompter with a Left JoyCon + QJoyControl

The teleprompter needs no special QJoyControl build — configure the stock app once.

## 1. Connect the JoyCon
Pair and connect the Left JoyCon over Bluetooth, then select it in QJoyControl and
click Connect (see QJoyControl's own README).

## 2. Enable the stick-as-mouse (the throttle)
In QJoyControl, enable **Left analog mouse** so the analog stick moves the mouse
cursor. Adjust the analog sensitivity slider so a full stick push moves the cursor
at a comfortably fast, steady rate. Disable **Gyro mouse** so only the stick moves
the cursor.

## 3. Map the buttons to these keys
Configure QJoyControl's button-to-key mapping for the Left JoyCon as follows:

| Left JoyCon input | Key | Teleprompter action        |
|-------------------|-----|----------------------------|
| D-pad Up          | i   | Text size up               |
| D-pad Down        | k   | Text size down             |
| D-pad Left        | j   | Seek back one paragraph    |
| D-pad Right       | l   | Seek forward one paragraph |
| SL                | q   | Decrease max scroll speed  |
| SR                | e   | Increase max scroll speed  |
| Stick click       | c   | Toggle cruise (auto-scroll)|

(These keys are defined in `src/config.ts` as `CONFIG.keyMap` — change both places
if you prefer different keys.)

## 4. Use it
1. Open the teleprompter (`npm run dev`, then the printed URL) and load a PDF.
2. **Click the text area once** to engage Pointer Lock (this lets the browser read
   the stick-as-mouse without the cursor hitting screen edges). Press **Esc** to
   release; click again to re-engage. The HUD shows "Controller ●" when engaged.
3. Drive it:
   - **Stick up / down** — scroll forward / reverse; how far you push sets the speed.
   - **Stick click** — toggle cruise (hands-free scroll at the max speed).
   - **D-pad up / down** — text size; **D-pad left / right** — seek by paragraph.
   - **SL / SR** — decrease / increase max scroll speed.

## Tuning
If the throttle feels too fast/slow, adjust QJoyControl's analog sensitivity and/or
`CONFIG.mouseFullThrottleRate` in `src/config.ts` (the mouse rate that equals full
throttle). If up/down are reversed, set `CONFIG.invertThrottle = true`.
```

---

## Task 7: Full test + build gate

- [ ] **Step 1: Run the whole unit suite**

Run: `npm test`
Expected: all suites pass. Suite count vs. the previous app: `parseFrame` (3 tests) removed, `mouseRateToStick` (7 tests) added — net change on the prior 28 is +4 → **32 tests**, across the same 6 files (parseFrame file removed, mouseRateToStick file added).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Production build (must not emit .js into src)**

Run: `npm run build`
Expected: succeeds, produces `dist/`.
Run: `find src -name '*.js' -type f`
Expected: prints nothing.

- [ ] **Step 4: Manual smoke test (keyboard source, no hardware)**

Run: `npm run dev`; open `http://localhost:5173/?input=keyboard`, load a text PDF, and confirm ArrowUp/Down throttle, `c` cruise, `i`/`k` size, `j`/`l` seek, `q`/`e` max speed all work (the keyboard path exercises the same downstream logic the QJoyControl path feeds).

---

## Done criteria

- WebSocket pathway fully removed; no dangling references.
- `mouseRateToStick` covered by unit tests; whole suite green (~32 tests).
- `npm run build` succeeds; no `.js` pollution in `src/`.
- Default (no query param) source is `QJoyControlInputSource`; clicking the text
  engages Pointer Lock; HUD reflects engaged/not-engaged.
- `QJOYCONTROL-SETUP.md` documents the stock-QJoyControl configuration.
- Manual keyboard smoke test passes. (Hardware integration per the setup guide is a
  user step.)
