# Teleprompter Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Source control note:** Do NOT run any git commands for this project until the user explicitly asks. The "Commit" steps below are written for completeness but must be SKIPPED until the user says otherwise. Complete the code/test steps normally.

**Goal:** Build a static browser teleprompter that loads a PDF, reflows its text as large scrolling type, and is driven by a JoyCon-style input stream (throttle scrolling, cruise, text size, paragraph seek).

**Architecture:** A framework-free TypeScript app built with Vite. Input arrives as `InputFrame` objects from a swappable `InputSource` (`WebSocketInputSource` for the real controller via QJoyControl; `KeyboardInputSource` for hardware-free dev/testing). Pure-logic modules (`ControlMapper`, `ScrollEngine`, `throttle`, `paragraphs`) hold all behavior and are unit-tested; DOM modules (`DocumentView`, `Hud`) are thin. A `requestAnimationFrame` loop in `main.ts` wires them together.

**Tech Stack:** TypeScript, Vite (dev server + static build), Vitest (unit tests), pdfjs-dist (PDF text extraction).

**Working directory:** Create the app under `teleprompter/` at the repo root (`/Users/chalter/CODE/prompter/teleprompter`). All paths below are relative to that directory unless noted.

---

## File Structure

- `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html` — project scaffold
- `src/config.ts` — tunable constants (ws URL, deadzone, speed/size limits & steps)
- `src/types.ts` — `InputFrame`, `Command`, `ScrollState`, `NEUTRAL_FRAME`
- `src/input/InputSource.ts` — the `InputSource` interface
- `src/input/parseFrame.ts` — pure JSON→`InputFrame` parser (+ `parseFrame.test.ts`)
- `src/input/WebSocketInputSource.ts` — live source, auto-reconnect
- `src/input/KeyboardInputSource.ts` — dev/test source
- `src/control/ControlMapper.ts` — edge detection → `Command[]` (+ test)
- `src/scroll/throttle.ts` — `applyDeadzone` (+ test)
- `src/scroll/ScrollEngine.ts` — state machine + velocity math (+ test)
- `src/document/paragraphs.ts` — pure text/paragraph helpers (+ test)
- `src/document/DocumentView.ts` — PDF load + reflow + font size (DOM)
- `src/hud/Hud.ts` — status overlay + `stateLabel` (+ test)
- `src/styles.css` — teleprompter + HUD styling
- `src/main.ts` — app wiring + rAF loop

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.ts` (placeholder)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "teleprompter",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "vitest": "^1.6.0"
  },
  "dependencies": {
    "pdfjs-dist": "^4.2.67"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "types": ["vitest/globals"],
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `vite.config.ts`**

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
```

- [ ] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>JoyCon Teleprompter</title>
  </head>
  <body>
    <div id="drop-zone">Drag a PDF here, or click to choose a file</div>
    <input id="file-input" type="file" accept="application/pdf" hidden />
    <main id="scroller"><div id="doc"></div></main>
    <div id="hud"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Create placeholder `src/main.ts`**

```ts
console.log('teleprompter boot');
```

- [ ] **Step 5b: Create `src/vite-env.d.ts`** (ambient types for `?url` and CSS imports, so `tsc` accepts them)

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 6: Install deps and verify the dev server boots**

Run: `npm install`
Then run: `npm run dev`
Expected: Vite prints a local URL (e.g. `http://localhost:5173`) with no errors. Stop it with Ctrl-C.

- [ ] **Step 7: Add jsdom for tests**

Run: `npm install -D jsdom`
Expected: installs without error (needed by the `environment: 'jsdom'` test config).

- [ ] **Step 8: Commit** _(SKIP — see source-control note)_

```bash
git add package.json tsconfig.json vite.config.ts index.html src/main.ts
git commit -m "chore: scaffold teleprompter Vite + TS + Vitest project"
```

---

## Task 2: Core types and config

**Files:**
- Create: `src/types.ts`
- Create: `src/config.ts`

- [ ] **Step 1: Create `src/types.ts`**

```ts
export interface StickState {
  x: number; // -1..1
  y: number; // -1..1, positive = up = scroll forward
}

export interface ButtonState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  sl: boolean;
  sr: boolean;
  stickClick: boolean;
}

export interface InputFrame {
  stick: StickState;
  buttons: ButtonState;
}

export type Command =
  | { type: 'toggleCruise' }
  | { type: 'sizeStep'; delta: 1 | -1 }
  | { type: 'seek'; delta: 1 | -1 }
  | { type: 'maxSpeedStep'; delta: 1 | -1 };

export type ScrollState = 'HOLD' | 'MANUAL' | 'CRUISE';

export const NEUTRAL_FRAME: InputFrame = {
  stick: { x: 0, y: 0 },
  buttons: {
    up: false, down: false, left: false, right: false,
    sl: false, sr: false, stickClick: false,
  },
};
```

- [ ] **Step 2: Create `src/config.ts`**

```ts
export const CONFIG = {
  wsUrl: 'ws://localhost:8420',
  reconnectDelayMs: 1000,
  deadzone: 0.08,
  minMaxSpeed: 20,    // px/s
  maxMaxSpeed: 1500,  // px/s
  maxSpeedStep: 60,   // px/s per SL/SR press
  initialMaxSpeed: 300,
  minFontSize: 16,    // px
  maxFontSize: 160,   // px
  fontSizeStep: 4,    // px per D-pad up/down press
  initialFontSize: 48,
  hudHideMs: 2500,
};
```

- [ ] **Step 3: Commit** _(SKIP — see source-control note)_

```bash
git add src/types.ts src/config.ts
git commit -m "feat: add core types and config"
```

---

## Task 3: `applyDeadzone` throttle helper (TDD)

**Files:**
- Create: `src/scroll/throttle.ts`
- Test: `src/scroll/throttle.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { applyDeadzone } from './throttle';

describe('applyDeadzone', () => {
  it('returns 0 inside the deadzone', () => {
    expect(applyDeadzone(0, 0.1)).toBe(0);
    expect(applyDeadzone(0.05, 0.1)).toBe(0);
    expect(applyDeadzone(-0.1, 0.1)).toBe(0);
  });

  it('rescales so full deflection maps to 1', () => {
    expect(applyDeadzone(1, 0.1)).toBeCloseTo(1, 5);
    expect(applyDeadzone(-1, 0.1)).toBeCloseTo(-1, 5);
  });

  it('is proportional just past the deadzone', () => {
    // halfway between deadzone(0.1) and 1.0 -> 0.5
    expect(applyDeadzone(0.55, 0.1)).toBeCloseTo(0.5, 5);
  });

  it('preserves sign', () => {
    expect(applyDeadzone(-0.55, 0.1)).toBeCloseTo(-0.5, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- throttle`
Expected: FAIL — `applyDeadzone` is not exported / module missing.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/scroll/throttle.ts
export function applyDeadzone(value: number, deadzone: number): number {
  const mag = Math.abs(value);
  if (mag <= deadzone) return 0;
  const sign = Math.sign(value);
  return (sign * (mag - deadzone)) / (1 - deadzone);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- throttle`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit** _(SKIP — see source-control note)_

```bash
git add src/scroll/throttle.ts src/scroll/throttle.test.ts
git commit -m "feat: add applyDeadzone throttle helper"
```

---

## Task 4: `ScrollEngine` state machine + velocity (TDD)

**Files:**
- Create: `src/scroll/ScrollEngine.ts`
- Test: `src/scroll/ScrollEngine.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { ScrollEngine } from './ScrollEngine';

const opts = { maxSpeed: 300, deadzone: 0.1 };

describe('ScrollEngine', () => {
  it('starts in HOLD and holds when centered', () => {
    const e = new ScrollEngine(opts);
    expect(e.state).toBe('HOLD');
    expect(e.velocity(0)).toBe(0);
    expect(e.state).toBe('HOLD');
  });

  it('goes MANUAL and scales velocity by deflection when the stick moves', () => {
    const e = new ScrollEngine(opts);
    expect(e.velocity(1)).toBeCloseTo(300, 5);
    expect(e.state).toBe('MANUAL');
  });

  it('reverses on downward stick', () => {
    const e = new ScrollEngine(opts);
    expect(e.velocity(-1)).toBeCloseTo(-300, 5);
  });

  it('cruises at max speed hands-free after toggleCruise', () => {
    const e = new ScrollEngine(opts);
    e.toggleCruise();
    expect(e.state).toBe('CRUISE');
    expect(e.velocity(0)).toBeCloseTo(300, 5);
    expect(e.state).toBe('CRUISE');
  });

  it('exits cruise to MANUAL when the stick is moved', () => {
    const e = new ScrollEngine(opts);
    e.toggleCruise();
    expect(e.velocity(1)).toBeCloseTo(300, 5);
    expect(e.state).toBe('MANUAL');
  });

  it('toggleCruise while cruising pauses to HOLD', () => {
    const e = new ScrollEngine(opts);
    e.toggleCruise();
    e.toggleCruise();
    expect(e.state).toBe('HOLD');
    expect(e.velocity(0)).toBe(0);
  });

  it('stop() forces HOLD', () => {
    const e = new ScrollEngine(opts);
    e.toggleCruise();
    e.stop();
    expect(e.state).toBe('HOLD');
  });

  it('clamps max speed on stepMaxSpeed', () => {
    const e = new ScrollEngine({ maxSpeed: 1490, deadzone: 0.1 });
    e.stepMaxSpeed(1); // +60 -> clamped to 1500
    expect(e.maxSpeed).toBe(1500);
    e.maxSpeed = 40;
    e.stepMaxSpeed(-1); // -60 -> clamped to 20
    expect(e.maxSpeed).toBe(20);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- ScrollEngine`
Expected: FAIL — module/class missing.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/scroll/ScrollEngine.ts
import type { ScrollState } from '../types';
import { applyDeadzone } from './throttle';
import { CONFIG } from '../config';

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export class ScrollEngine {
  state: ScrollState = 'HOLD';
  maxSpeed: number;
  private deadzone: number;

  constructor(opts?: { maxSpeed?: number; deadzone?: number }) {
    this.maxSpeed = opts?.maxSpeed ?? CONFIG.initialMaxSpeed;
    this.deadzone = opts?.deadzone ?? CONFIG.deadzone;
  }

  toggleCruise(): void {
    this.state = this.state === 'CRUISE' ? 'HOLD' : 'CRUISE';
  }

  stop(): void {
    this.state = 'HOLD';
  }

  stepMaxSpeed(delta: 1 | -1): void {
    this.maxSpeed = clamp(
      this.maxSpeed + delta * CONFIG.maxSpeedStep,
      CONFIG.minMaxSpeed,
      CONFIG.maxMaxSpeed,
    );
  }

  /** Velocity in px/s (positive = forward/down). Updates state from stick input. */
  velocity(stickY: number): number {
    const deflection = applyDeadzone(stickY, this.deadzone);
    if (this.state === 'CRUISE') {
      if (deflection !== 0) {
        this.state = 'MANUAL';
        return deflection * this.maxSpeed;
      }
      return this.maxSpeed;
    }
    if (deflection !== 0) {
      this.state = 'MANUAL';
      return deflection * this.maxSpeed;
    }
    this.state = 'HOLD';
    return 0;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- ScrollEngine`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit** _(SKIP — see source-control note)_

```bash
git add src/scroll/ScrollEngine.ts src/scroll/ScrollEngine.test.ts
git commit -m "feat: add ScrollEngine state machine and velocity model"
```

---

## Task 5: `ControlMapper` edge detection (TDD)

**Files:**
- Create: `src/control/ControlMapper.ts`
- Test: `src/control/ControlMapper.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { ControlMapper } from './ControlMapper';
import { NEUTRAL_FRAME, type InputFrame } from '../types';

function frameWith(overrides: Partial<InputFrame['buttons']>): InputFrame {
  return {
    stick: { x: 0, y: 0 },
    buttons: { ...NEUTRAL_FRAME.buttons, ...overrides },
  };
}

describe('ControlMapper', () => {
  it('emits toggleCruise on a stick-click press edge', () => {
    const m = new ControlMapper();
    expect(m.update(frameWith({ stickClick: true }))).toEqual([{ type: 'toggleCruise' }]);
  });

  it('does not repeat a command while the button stays held', () => {
    const m = new ControlMapper();
    m.update(frameWith({ stickClick: true }));
    expect(m.update(frameWith({ stickClick: true }))).toEqual([]);
  });

  it('fires again after release then re-press', () => {
    const m = new ControlMapper();
    m.update(frameWith({ stickClick: true }));
    m.update(NEUTRAL_FRAME);
    expect(m.update(frameWith({ stickClick: true }))).toEqual([{ type: 'toggleCruise' }]);
  });

  it('maps the d-pad and shoulders', () => {
    const m = new ControlMapper();
    expect(m.update(frameWith({ up: true }))).toEqual([{ type: 'sizeStep', delta: 1 }]);
    m.update(NEUTRAL_FRAME);
    expect(m.update(frameWith({ down: true }))).toEqual([{ type: 'sizeStep', delta: -1 }]);
    m.update(NEUTRAL_FRAME);
    expect(m.update(frameWith({ right: true }))).toEqual([{ type: 'seek', delta: 1 }]);
    m.update(NEUTRAL_FRAME);
    expect(m.update(frameWith({ left: true }))).toEqual([{ type: 'seek', delta: -1 }]);
    m.update(NEUTRAL_FRAME);
    expect(m.update(frameWith({ sr: true }))).toEqual([{ type: 'maxSpeedStep', delta: 1 }]);
    m.update(NEUTRAL_FRAME);
    expect(m.update(frameWith({ sl: true }))).toEqual([{ type: 'maxSpeedStep', delta: -1 }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- ControlMapper`
Expected: FAIL — module/class missing.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/control/ControlMapper.ts
import type { InputFrame, Command, ButtonState } from '../types';
import { NEUTRAL_FRAME } from '../types';

export class ControlMapper {
  private prev: InputFrame = NEUTRAL_FRAME;

  update(frame: InputFrame): Command[] {
    const cmds: Command[] = [];
    const pressed = (b: keyof ButtonState): boolean =>
      frame.buttons[b] && !this.prev.buttons[b];

    if (pressed('stickClick')) cmds.push({ type: 'toggleCruise' });
    if (pressed('up')) cmds.push({ type: 'sizeStep', delta: 1 });
    if (pressed('down')) cmds.push({ type: 'sizeStep', delta: -1 });
    if (pressed('right')) cmds.push({ type: 'seek', delta: 1 });
    if (pressed('left')) cmds.push({ type: 'seek', delta: -1 });
    if (pressed('sr')) cmds.push({ type: 'maxSpeedStep', delta: 1 });
    if (pressed('sl')) cmds.push({ type: 'maxSpeedStep', delta: -1 });

    this.prev = frame;
    return cmds;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- ControlMapper`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit** _(SKIP — see source-control note)_

```bash
git add src/control/ControlMapper.ts src/control/ControlMapper.test.ts
git commit -m "feat: add ControlMapper edge detection"
```

---

## Task 6: Paragraph helpers (TDD)

**Files:**
- Create: `src/document/paragraphs.ts`
- Test: `src/document/paragraphs.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { itemsToText, textToParagraphs, nextParagraphOffset } from './paragraphs';

describe('itemsToText', () => {
  it('joins items and inserts newlines on hasEOL', () => {
    const items = [
      { str: 'Hello ', hasEOL: false },
      { str: 'world', hasEOL: true },
      { str: 'next line', hasEOL: true },
    ];
    expect(itemsToText(items)).toBe('Hello world\nnext line\n');
  });
});

describe('textToParagraphs', () => {
  it('splits on blank lines and joins wrapped lines', () => {
    const text = 'Line one\nline one cont.\n\nSecond para\n';
    expect(textToParagraphs(text)).toEqual(['Line one line one cont.', 'Second para']);
  });

  it('returns an empty array for whitespace-only text', () => {
    expect(textToParagraphs('   \n\n  \n')).toEqual([]);
  });
});

describe('nextParagraphOffset', () => {
  const offsets = [0, 100, 250, 400];
  it('jumps to the next paragraph forward', () => {
    expect(nextParagraphOffset(offsets, 100, 1)).toBe(250);
  });
  it('jumps to the previous paragraph backward', () => {
    expect(nextParagraphOffset(offsets, 260, -1)).toBe(250);
  });
  it('clamps at the ends', () => {
    expect(nextParagraphOffset(offsets, 500, 1)).toBe(400);
    expect(nextParagraphOffset(offsets, 0, -1)).toBe(0);
  });
  it('returns currentTop when there are no offsets', () => {
    expect(nextParagraphOffset([], 123, 1)).toBe(123);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- paragraphs`
Expected: FAIL — module/functions missing.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/document/paragraphs.ts
export interface RawTextItem {
  str: string;
  hasEOL: boolean;
}

export function itemsToText(items: RawTextItem[]): string {
  return items.map((i) => i.str + (i.hasEOL ? '\n' : '')).join('');
}

export function textToParagraphs(text: string): string[] {
  return text
    .split(/\n[ \t]*\n+/) // blank line = paragraph break
    .map((p) => p.replace(/\s*\n\s*/g, ' ').replace(/[ \t]+/g, ' ').trim())
    .filter((p) => p.length > 0);
}

export function nextParagraphOffset(
  offsets: number[],
  currentTop: number,
  delta: 1 | -1,
): number {
  if (offsets.length === 0) return currentTop;
  const eps = 1;
  if (delta === 1) {
    for (const o of offsets) if (o > currentTop + eps) return o;
    return offsets[offsets.length - 1];
  }
  for (let i = offsets.length - 1; i >= 0; i--) {
    if (offsets[i] < currentTop - eps) return offsets[i];
  }
  return 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- paragraphs`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit** _(SKIP — see source-control note)_

```bash
git add src/document/paragraphs.ts src/document/paragraphs.test.ts
git commit -m "feat: add paragraph extraction and seek helpers"
```

---

## Task 7: `parseFrame` WebSocket message parser (TDD)

**Files:**
- Create: `src/input/parseFrame.ts`
- Test: `src/input/parseFrame.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { parseFrame } from './parseFrame';

describe('parseFrame', () => {
  it('parses a valid input message', () => {
    const json = JSON.stringify({
      type: 'input',
      seq: 5,
      stick: { x: -0.2, y: 0.8 },
      buttons: { up: true, sr: true, stickClick: false },
    });
    const f = parseFrame(json);
    expect(f.stick).toEqual({ x: -0.2, y: 0.8 });
    expect(f.buttons.up).toBe(true);
    expect(f.buttons.sr).toBe(true);
    expect(f.buttons.down).toBe(false);
  });

  it('defaults missing fields and clamps stick to -1..1', () => {
    const json = JSON.stringify({ type: 'input', stick: { x: 5, y: -9 } });
    const f = parseFrame(json);
    expect(f.stick).toEqual({ x: 1, y: -1 });
    expect(f.buttons.up).toBe(false);
  });

  it('throws on a non-input message', () => {
    expect(() => parseFrame(JSON.stringify({ type: 'hello' }))).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- parseFrame`
Expected: FAIL — module/function missing.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/input/parseFrame.ts
import type { InputFrame } from '../types';

function clampAxis(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  return Math.max(-1, Math.min(1, n));
}

export function parseFrame(json: string): InputFrame {
  const msg = JSON.parse(json);
  if (!msg || msg.type !== 'input') {
    throw new Error('not an input message');
  }
  const b = msg.buttons ?? {};
  return {
    stick: { x: clampAxis(msg.stick?.x), y: clampAxis(msg.stick?.y) },
    buttons: {
      up: !!b.up, down: !!b.down, left: !!b.left, right: !!b.right,
      sl: !!b.sl, sr: !!b.sr, stickClick: !!b.stickClick,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- parseFrame`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit** _(SKIP — see source-control note)_

```bash
git add src/input/parseFrame.ts src/input/parseFrame.test.ts
git commit -m "feat: add WebSocket frame parser"
```

---

## Task 8: `InputSource` interface + `WebSocketInputSource`

**Files:**
- Create: `src/input/InputSource.ts`
- Create: `src/input/WebSocketInputSource.ts`

- [ ] **Step 1: Create the `InputSource` interface**

```ts
// src/input/InputSource.ts
import type { InputFrame } from '../types';

export interface InputSource {
  /** Latest controller state; NEUTRAL_FRAME when idle/disconnected. */
  getFrame(): InputFrame;
  /** True when a live source is connected (always true for the keyboard source). */
  isConnected(): boolean;
  start(): void;
  stop(): void;
}
```

- [ ] **Step 2: Implement `WebSocketInputSource`**

```ts
// src/input/WebSocketInputSource.ts
import type { InputFrame } from '../types';
import { NEUTRAL_FRAME } from '../types';
import type { InputSource } from './InputSource';
import { parseFrame } from './parseFrame';
import { CONFIG } from '../config';

export class WebSocketInputSource implements InputSource {
  private ws: WebSocket | null = null;
  private frame: InputFrame = NEUTRAL_FRAME;
  private connected = false;
  private stopped = false;
  private reconnectTimer: number | null = null;

  constructor(private url: string = CONFIG.wsUrl) {}

  getFrame(): InputFrame {
    return this.connected ? this.frame : NEUTRAL_FRAME;
  }

  isConnected(): boolean {
    return this.connected;
  }

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this.connected = false;
  }

  private connect(): void {
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws.onopen = () => { this.connected = true; };
    this.ws.onmessage = (ev) => {
      try {
        this.frame = parseFrame(String(ev.data));
      } catch {
        /* ignore malformed frames */
      }
    };
    this.ws.onclose = () => {
      this.connected = false;
      this.frame = NEUTRAL_FRAME;
      this.scheduleReconnect();
    };
    this.ws.onerror = () => { this.ws?.close(); };
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    this.reconnectTimer = window.setTimeout(
      () => this.connect(),
      CONFIG.reconnectDelayMs,
    );
  }
}
```

- [ ] **Step 3: Verify the project type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit** _(SKIP — see source-control note)_

```bash
git add src/input/InputSource.ts src/input/WebSocketInputSource.ts
git commit -m "feat: add InputSource interface and WebSocket source"
```

---

## Task 9: `KeyboardInputSource` (hardware-free dev/testing)

**Files:**
- Create: `src/input/KeyboardInputSource.ts`

- [ ] **Step 1: Implement `KeyboardInputSource`**

Key map (documented in the file): ArrowUp/ArrowDown = throttle up/down; `c` = stick click (cruise); `]`/`[` = d-pad up/down (text size); `.`/`,` = d-pad right/left (seek); `=`/`-` = SR/SL (max speed).

```ts
// src/input/KeyboardInputSource.ts
import type { InputFrame, ButtonState } from '../types';
import { NEUTRAL_FRAME } from '../types';
import type { InputSource } from './InputSource';

const KEY_TO_BUTTON: Record<string, keyof ButtonState> = {
  ']': 'up',    // text size up
  '[': 'down',  // text size down
  '.': 'right', // seek forward
  ',': 'left',  // seek back
  '=': 'sr',    // max speed up
  '-': 'sl',    // max speed down
  'c': 'stickClick', // toggle cruise
};

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
    const btn = KEY_TO_BUTTON[key];
    if (btn) this.frame.buttons[btn] = down;
  }
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit** _(SKIP — see source-control note)_

```bash
git add src/input/KeyboardInputSource.ts
git commit -m "feat: add keyboard input source for hardware-free testing"
```

---

## Task 10: `DocumentView` (PDF load + reflow + font size)

**Files:**
- Create: `src/document/DocumentView.ts`

- [ ] **Step 1: Implement `DocumentView`**

```ts
// src/document/DocumentView.ts
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { itemsToText, textToParagraphs, type RawTextItem } from './paragraphs';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export class DocumentView {
  private paras: HTMLElement[] = [];

  constructor(private container: HTMLElement) {}

  /** Loads a PDF file, extracts+reflows text. Returns the paragraph count. */
  async loadFile(file: File): Promise<{ paragraphCount: number }> {
    const data = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    let allText = '';
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const items: RawTextItem[] = content.items.map((it: any) => ({
        str: typeof it.str === 'string' ? it.str : '',
        hasEOL: !!it.hasEOL,
      }));
      allText += itemsToText(items) + '\n\n';
    }
    const paragraphs = textToParagraphs(allText);
    this.render(paragraphs);
    return { paragraphCount: paragraphs.length };
  }

  private render(paragraphs: string[]): void {
    this.container.innerHTML = '';
    this.paras = [];
    if (paragraphs.length === 0) {
      const msg = document.createElement('p');
      msg.className = 'tp-empty';
      msg.textContent = 'No selectable text found in this PDF.';
      this.container.appendChild(msg);
      return;
    }
    for (const text of paragraphs) {
      const el = document.createElement('p');
      el.className = 'tp-para';
      el.textContent = text;
      this.container.appendChild(el);
      this.paras.push(el);
    }
  }

  setFontSize(px: number): void {
    this.container.style.fontSize = `${px}px`;
  }

  /** offsetTop of each paragraph, for seeking. */
  paragraphOffsets(): number[] {
    return this.paras.map((p) => p.offsetTop);
  }

  hasContent(): boolean {
    return this.paras.length > 0;
  }
}
```

- [ ] **Step 2: Verify type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: builds with no errors (confirms the `?url` worker import and pdfjs resolve under Vite).

- [ ] **Step 3: Commit** _(SKIP — see source-control note)_

```bash
git add src/document/DocumentView.ts
git commit -m "feat: add DocumentView PDF loader and text reflow"
```

---

## Task 11: `Hud` overlay + `stateLabel` (TDD for the pure part)

**Files:**
- Create: `src/hud/Hud.ts`
- Test: `src/hud/Hud.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { stateLabel } from './Hud';

describe('stateLabel', () => {
  it('maps scroll states to human labels', () => {
    expect(stateLabel('HOLD')).toBe('Paused');
    expect(stateLabel('MANUAL')).toBe('Manual');
    expect(stateLabel('CRUISE')).toBe('Cruise');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- Hud`
Expected: FAIL — module/function missing.

- [ ] **Step 3: Implement `Hud`**

```ts
// src/hud/Hud.ts
import type { ScrollState } from '../types';

export function stateLabel(state: ScrollState): string {
  switch (state) {
    case 'HOLD': return 'Paused';
    case 'MANUAL': return 'Manual';
    case 'CRUISE': return 'Cruise';
  }
}

export interface HudModel {
  connected: boolean;
  state: ScrollState;
  maxSpeed: number;
  fontSize: number;
  progress: number; // 0..1
}

export class Hud {
  constructor(private el: HTMLElement) {}

  update(m: HudModel): void {
    const pct = Math.round(m.progress * 100);
    this.el.innerHTML = `
      <span class="hud-item ${m.connected ? 'ok' : 'bad'}">${m.connected ? 'Controller ●' : 'Disconnected ○'}</span>
      <span class="hud-item">${stateLabel(m.state)}</span>
      <span class="hud-item">Max ${Math.round(m.maxSpeed)} px/s</span>
      <span class="hud-item">Text ${Math.round(m.fontSize)} px</span>
      <span class="hud-item">${pct}%</span>
    `;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- Hud`
Expected: PASS (1 test).

- [ ] **Step 5: Commit** _(SKIP — see source-control note)_

```bash
git add src/hud/Hud.ts src/hud/Hud.test.ts
git commit -m "feat: add HUD overlay"
```

---

## Task 12: Styles

**Files:**
- Create: `src/styles.css`

- [ ] **Step 1: Create `src/styles.css`**

```css
:root { color-scheme: dark; }
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: #000; color: #f4f4f4;
  font-family: Georgia, 'Times New Roman', serif; }

#scroller {
  position: fixed; inset: 0; overflow: hidden; scroll-behavior: auto;
  padding: 50vh 8vw; /* half-screen padding so first/last lines can center */
}
#doc { font-size: 48px; line-height: 1.5; max-width: 20ch; margin: 0 auto;
  text-align: center; }
.tp-para { margin: 0 0 1.2em; }
.tp-empty { color: #ff8080; font-size: 0.6em; }

#drop-zone {
  position: fixed; inset: 0; z-index: 10; display: flex;
  align-items: center; justify-content: center; text-align: center;
  background: rgba(0,0,0,0.85); color: #bbb; font-size: 22px; cursor: pointer;
}
#drop-zone.hidden { display: none; }
#drop-zone.dragover { background: rgba(40,80,40,0.9); color: #fff; }

#hud {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 5;
  display: flex; gap: 18px; justify-content: center; align-items: center;
  padding: 8px; background: rgba(0,0,0,0.55); font-family: system-ui, sans-serif;
  font-size: 13px; transition: opacity 0.4s; opacity: 1;
}
#hud.faded { opacity: 0; }
.hud-item { color: #cfd8e3; }
.hud-item.ok { color: #7fd88f; }
.hud-item.bad { color: #e08080; }
```

- [ ] **Step 2: Commit** _(SKIP — see source-control note)_

```bash
git add src/styles.css
git commit -m "feat: add teleprompter and HUD styles"
```

---

## Task 13: App wiring + rAF loop

**Files:**
- Modify: `src/main.ts` (replace placeholder)

- [ ] **Step 1: Implement `src/main.ts`**

Uses `?input=keyboard` in the URL to select the keyboard source for hardware-free testing; otherwise uses the WebSocket source. Applies commands, runs the scroll loop, clamps bounds, stops cruise at the bottom, and updates the HUD (auto-hiding after inactivity).

```ts
// src/main.ts
import './styles.css';
import { CONFIG } from './config';
import { ControlMapper } from './control/ControlMapper';
import { ScrollEngine } from './scroll/ScrollEngine';
import { DocumentView } from './document/DocumentView';
import { nextParagraphOffset } from './document/paragraphs';
import { Hud } from './hud/Hud';
import type { InputSource } from './input/InputSource';
import { WebSocketInputSource } from './input/WebSocketInputSource';
import { KeyboardInputSource } from './input/KeyboardInputSource';

const scroller = document.getElementById('scroller') as HTMLElement;
const docEl = document.getElementById('doc') as HTMLElement;
const dropZone = document.getElementById('drop-zone') as HTMLElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const hudEl = document.getElementById('hud') as HTMLElement;

const view = new DocumentView(docEl);
const engine = new ScrollEngine();
const mapper = new ControlMapper();
const hud = new Hud(hudEl);

const useKeyboard = new URLSearchParams(location.search).get('input') === 'keyboard';
const source: InputSource = useKeyboard
  ? new KeyboardInputSource()
  : new WebSocketInputSource();
source.start();

let fontSize = CONFIG.initialFontSize;
view.setFontSize(fontSize);

// ---- file loading ----
async function loadFile(file: File) {
  const { paragraphCount } = await view.loadFile(file);
  dropZone.classList.add('hidden');
  scroller.scrollTop = 0;
  engine.stop();
  if (paragraphCount === 0) engine.stop();
}
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  const f = fileInput.files?.[0];
  if (f) void loadFile(f);
});
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const f = e.dataTransfer?.files?.[0];
  if (f) void loadFile(f);
});

// ---- HUD auto-hide ----
let lastActivity = 0;
function markActivity(now: number) { lastActivity = now; hudEl.classList.remove('faded'); }

// ---- command handling ----
function applyCommand(cmd: ReturnType<ControlMapper['update']>[number]) {
  switch (cmd.type) {
    case 'toggleCruise':
      engine.toggleCruise();
      break;
    case 'maxSpeedStep':
      engine.stepMaxSpeed(cmd.delta);
      break;
    case 'sizeStep':
      fontSize = Math.max(CONFIG.minFontSize,
        Math.min(CONFIG.maxFontSize, fontSize + cmd.delta * CONFIG.fontSizeStep));
      view.setFontSize(fontSize);
      break;
    case 'seek': {
      const target = nextParagraphOffset(view.paragraphOffsets(), scroller.scrollTop, cmd.delta);
      scroller.scrollTop = target;
      break;
    }
  }
}

// ---- main loop ----
let prevTs: number | null = null;
function tick(ts: number) {
  const dt = prevTs === null ? 0 : (ts - prevTs) / 1000;
  prevTs = ts;

  const frame = source.getFrame();
  const cmds = mapper.update(frame);
  if (cmds.length) markActivity(ts);
  for (const cmd of cmds) applyCommand(cmd);

  const v = engine.velocity(frame.stick.y);
  if (v !== 0) markActivity(ts);
  const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  let pos = scroller.scrollTop + v * dt;
  if (pos <= 0) { pos = 0; }
  if (pos >= maxScroll) { pos = maxScroll; if (engine.state === 'CRUISE') engine.stop(); }
  scroller.scrollTop = pos;

  if (ts - lastActivity > CONFIG.hudHideMs) hudEl.classList.add('faded');

  hud.update({
    connected: source.isConnected(),
    state: engine.state,
    maxSpeed: engine.maxSpeed,
    fontSize,
    progress: maxScroll > 0 ? pos / maxScroll : 0,
  });

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
```

- [ ] **Step 2: Verify type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors; `dist/` produced.

- [ ] **Step 3: Manual smoke test (keyboard source, no hardware)**

Run: `npm run dev`
Open `http://localhost:5173/?input=keyboard`, choose a text-based PDF, then verify:
- ArrowUp scrolls forward, ArrowDown reverses, release stops (HOLD).
- `c` starts cruise (scrolls hands-free at max speed); `c` again pauses; nudging ArrowUp takes over.
- `]`/`[` change text size; `.`/`,` jump paragraphs; `=`/`-` change max speed (HUD updates).
- Loading an image-only PDF shows "No selectable text found in this PDF."

- [ ] **Step 4: Commit** _(SKIP — see source-control note)_

```bash
git add src/main.ts
git commit -m "feat: wire teleprompter app loop"
```

---

## Task 14: Full test + build gate

- [ ] **Step 1: Run the whole unit suite**

Run: `npm test`
Expected: all suites pass (throttle, ScrollEngine, ControlMapper, paragraphs, parseFrame, Hud).

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: `dist/` built with no type or bundle errors.

- [ ] **Step 3: Commit** _(SKIP — see source-control note)_

```bash
git add -A
git commit -m "test: green unit suite and production build for teleprompter"
```

---

## Done criteria

- All unit tests pass; `npm run build` succeeds.
- With `?input=keyboard`, the full control set works against a real text PDF.
- App connects to `ws://localhost:8420` by default (exercised end-to-end once the QJoyControl bridge plan is implemented).
