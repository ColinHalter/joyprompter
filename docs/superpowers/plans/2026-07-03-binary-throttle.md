# Binary Throttle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the proportional mouse-derived throttle with a binary up/down control that scrolls at `maxSpeed`, driven by QJoyControl mapping the stick to the Arrow Up/Down keys.

**Architecture:** Delete the Pointer Lock mouse pipeline entirely. Collapse the two input sources into a single key-driven source that reports `stick.y ∈ {-1, 0, +1}`. `ScrollEngine` is unchanged — `deflection * maxSpeed` with a quantized `stick.y` already yields binary max-speed motion. Remove the now-meaningless HUD "controller connected" indicator.

**Tech Stack:** TypeScript · Vite · Vitest (jsdom, globals enabled) · PDF.js

**Design doc:** [docs/superpowers/specs/2026-07-03-binary-throttle-design.md](../specs/2026-07-03-binary-throttle-design.md)

---

## File overview

- `src/input/KeyInputSource.ts` (renamed from `KeyboardInputSource.ts`) — the sole input source. Maps Arrow Up/Down → binary `stick.y`, `CONFIG.keyMap` keys → buttons.
- `src/input/KeyInputSource.test.ts` (new) — unit tests for the throttle direction logic and button mapping.
- `src/input/InputSource.ts` — interface; loses `isConnected()`.
- `src/input/QJoyControlInputSource.ts` — **deleted** (Pointer Lock/mouse capture).
- `src/input/mouseRateToStick.ts` + `.test.ts` — **deleted** (analog-only helper).
- `src/main.ts` — one input source, no Pointer Lock, no engage flow, no `connected` in HUD model.
- `src/hud/Hud.ts` — drops the controller indicator and `connected` field.
- `src/config.ts` — drops `mouseFullThrottleRate` and `invertThrottle`.
- `README.md`, `QJOYCONTROL-SETUP.md` — docs updated for the binary throttle.

---

## Task 1: Rename to KeyInputSource and harden throttle direction (TDD)

**Files:**
- Rename: `src/input/KeyboardInputSource.ts` → `src/input/KeyInputSource.ts`
- Create: `src/input/KeyInputSource.test.ts`
- Modify: `src/main.ts` (import + instantiation of the keyboard source only)

- [ ] **Step 1: Write the failing test**

Create `src/input/KeyInputSource.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KeyInputSource } from './KeyInputSource';

const press = (key: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key }));
const release = (key: string) => window.dispatchEvent(new KeyboardEvent('keyup', { key }));

describe('KeyInputSource', () => {
  let src: KeyInputSource;
  beforeEach(() => { src = new KeyInputSource(); src.start(); });
  afterEach(() => { src.stop(); });

  it('reports +1 while ArrowUp is held', () => {
    press('ArrowUp');
    expect(src.getFrame().stick.y).toBe(1);
  });
  it('reports -1 while ArrowDown is held', () => {
    press('ArrowDown');
    expect(src.getFrame().stick.y).toBe(-1);
  });
  it('reports 0 when nothing is held', () => {
    expect(src.getFrame().stick.y).toBe(0);
  });
  it('cancels to 0 when both arrows are held', () => {
    press('ArrowUp');
    press('ArrowDown');
    expect(src.getFrame().stick.y).toBe(0);
  });
  it('resolves to the remaining direction when one of two held arrows is released', () => {
    press('ArrowUp');
    press('ArrowDown');
    release('ArrowUp');
    expect(src.getFrame().stick.y).toBe(-1);
  });
  it('maps configured keys to buttons', () => {
    press('z'); // CONFIG.keyMap.z -> 'zl'
    expect(src.getFrame().buttons.zl).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/input/KeyInputSource.test.ts`
Expected: FAIL — cannot resolve `'./KeyInputSource'` (module does not exist yet).

- [ ] **Step 3: Create the renamed source with hardened throttle logic**

Create `src/input/KeyInputSource.ts` with the full contents below, then delete the old `src/input/KeyboardInputSource.ts`:

```ts
import type { InputFrame, ButtonState } from '../types';
import { NEUTRAL_FRAME } from '../types';
import type { InputSource } from './InputSource';
import { CONFIG } from '../config';

/**
 * The app's sole input source. QJoyControl (or a bare keyboard for testing)
 * delivers everything as key events: ArrowUp / ArrowDown are the binary throttle
 * (stick up / down), and the CONFIG.keyMap keys are the buttons.
 */
export class KeyInputSource implements InputSource {
  private frame: InputFrame = structuredClone(NEUTRAL_FRAME);
  private upHeld = false;
  private downHeld = false;
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
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      if (key === 'ArrowUp') this.upHeld = down;
      else this.downHeld = down;
      this.frame.stick.y = (this.upHeld ? 1 : 0) - (this.downHeld ? 1 : 0);
      return;
    }
    const btn: keyof ButtonState | undefined = CONFIG.keyMap[key];
    if (btn) this.frame.buttons[btn] = down;
  }
}
```

Delete the old file:

```bash
git rm src/input/KeyboardInputSource.ts
```

- [ ] **Step 4: Update the import in main.ts**

In `src/main.ts`, change the keyboard-source import and its use so the project still compiles. Replace this import line:

```ts
import { KeyboardInputSource } from './input/KeyboardInputSource';
```

with:

```ts
import { KeyInputSource } from './input/KeyInputSource';
```

And in the source-selection block, replace:

```ts
  source = new KeyboardInputSource();
```

with:

```ts
  source = new KeyInputSource();
```

(Leave the rest of `main.ts` — the `?input=keyboard` branch, `QJoyControlInputSource`, `engage` — untouched in this task; it is removed in Task 2.)

- [ ] **Step 5: Run tests and type-check**

Run: `npx vitest run src/input/KeyInputSource.test.ts`
Expected: PASS (6 tests).

Run: `npm test`
Expected: full suite PASS.

Run: `npx tsc --noEmit -p tsconfig.build.json`
Expected: no output, exit 0.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: rename input source to KeyInputSource, harden throttle direction"
```

---

## Task 2: Collapse main.ts to a single source and remove the HUD controller indicator

**Files:**
- Modify: `src/main.ts`
- Modify: `src/hud/Hud.ts`

- [ ] **Step 1: Rewrite src/main.ts to use only KeyInputSource**

Replace the entire contents of `src/main.ts` with:

```ts
import './styles.css';
import { CONFIG } from './config';
import { ControlMapper } from './control/ControlMapper';
import { ScrollEngine } from './scroll/ScrollEngine';
import { DocumentView } from './document/DocumentView';
import { nextParagraphOffset } from './document/paragraphs';
import { Hud } from './hud/Hud';
import { KeyInputSource } from './input/KeyInputSource';

const scroller = document.getElementById('scroller') as HTMLElement;
const docEl = document.getElementById('doc') as HTMLElement;
const dropZone = document.getElementById('drop-zone') as HTMLElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const hudEl = document.getElementById('hud') as HTMLElement;

const view = new DocumentView(docEl);
const engine = new ScrollEngine();
const mapper = new ControlMapper();
const hud = new Hud(hudEl);

const source = new KeyInputSource();
source.start();

let fontSize = CONFIG.initialFontSize;
view.setFontSize(fontSize);

// ---- file loading ----
let loading = false;
async function loadFile(file: File) {
  if (loading) return;
  loading = true;
  try {
    await view.loadFile(file);
    dropZone.classList.add('hidden');
    scroller.scrollTop = 0;
    engine.stop();
  } catch (err) {
    console.error('Failed to load PDF:', err);
    dropZone.classList.remove('hidden');
    dropZone.textContent = 'Could not read that PDF. Click or drag another file.';
  } finally {
    loading = false;
  }
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
    state: engine.state,
    maxSpeed: engine.maxSpeed,
    fontSize,
    progress: maxScroll > 0 ? pos / maxScroll : 0,
  });

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
```

- [ ] **Step 2: Remove the controller indicator from src/hud/Hud.ts**

Replace the entire contents of `src/hud/Hud.ts` with:

```ts
import type { ScrollState } from '../types';

export function stateLabel(state: ScrollState): string {
  switch (state) {
    case 'HOLD': return 'Paused';
    case 'MANUAL': return 'Manual';
    case 'CRUISE': return 'Cruise';
  }
}

export interface HudModel {
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
      <span class="hud-item">${stateLabel(m.state)}</span>
      <span class="hud-item">Max ${Math.round(m.maxSpeed)} px/s</span>
      <span class="hud-item">Text ${Math.round(m.fontSize)} px</span>
      <span class="hud-item">${pct}%</span>
    `;
  }
}
```

- [ ] **Step 3: Type-check and run tests**

Run: `npx tsc --noEmit -p tsconfig.build.json`
Expected: no output, exit 0. (`QJoyControlInputSource.ts` and `mouseRateToStick.ts` still exist and compile; they are simply no longer imported.)

Run: `npm test`
Expected: full suite PASS (the `Hud` `stateLabel` test is unaffected).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: single key-driven input source, drop Pointer Lock and HUD controller badge"
```

---

## Task 3: Delete the dead mouse-throttle pipeline and its config

**Files:**
- Delete: `src/input/QJoyControlInputSource.ts`
- Delete: `src/input/mouseRateToStick.ts`
- Delete: `src/input/mouseRateToStick.test.ts`
- Modify: `src/config.ts`

- [ ] **Step 1: Delete the unused files**

```bash
git rm src/input/QJoyControlInputSource.ts src/input/mouseRateToStick.ts src/input/mouseRateToStick.test.ts
```

- [ ] **Step 2: Remove the mouse-only config settings**

In `src/config.ts`, replace this block:

```ts
export const CONFIG = {
  // Throttle (stick-as-mouse via Pointer Lock)
  mouseFullThrottleRate: 1200, // px/s of mouse movement that maps to full throttle
  invertThrottle: false,       // flip if QJoyControl's mouse Y is inverted
  deadzone: 0.08,
```

with:

```ts
export const CONFIG = {
  // Scroll throttle
  deadzone: 0.08,
```

- [ ] **Step 3: Type-check and run tests**

Run: `npx tsc --noEmit -p tsconfig.build.json`
Expected: no output, exit 0. (Nothing references the deleted files or the removed config fields.)

Run: `npm test`
Expected: full suite PASS. The `mouseRateToStick` tests are gone; remaining suites pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete mouse-throttle pipeline and its config"
```

---

## Task 4: Drop the unused isConnected from the InputSource interface

**Files:**
- Modify: `src/input/InputSource.ts`
- Modify: `src/input/KeyInputSource.ts`

- [ ] **Step 1: Remove isConnected from the interface**

Replace the entire contents of `src/input/InputSource.ts` with:

```ts
import type { InputFrame } from '../types';

export interface InputSource {
  /** Latest controller state; NEUTRAL_FRAME when idle. */
  getFrame(): InputFrame;
  start(): void;
  stop(): void;
}
```

- [ ] **Step 2: Remove isConnected from KeyInputSource**

In `src/input/KeyInputSource.ts`, delete this method:

```ts
  isConnected(): boolean {
    return true;
  }
```

- [ ] **Step 3: Type-check and run tests**

Run: `npx tsc --noEmit -p tsconfig.build.json`
Expected: no output, exit 0. (No caller references `isConnected` after Task 2.)

Run: `npm test`
Expected: full suite PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: drop unused isConnected from InputSource"
```

---

## Task 5: Update the documentation

**Files:**
- Modify: `QJOYCONTROL-SETUP.md`
- Modify: `README.md`

This is a docs-only task — no code, no tests to run beyond a final full-suite sanity check.

- [ ] **Step 1: Update QJOYCONTROL-SETUP.md — section 2 (stick mapping)**

Replace this block:

```markdown
## 2. Enable the stick-as-mouse (the throttle)
In QJoyControl, enable **Left analog mouse** so the analog stick moves the mouse
cursor. Adjust the analog sensitivity slider so a full stick push moves the cursor
at a comfortably fast, steady rate. Disable **Gyro mouse** so only the stick moves
the cursor.
```

with:

```markdown
## 2. Map the stick to the arrow keys (the throttle)
The throttle is binary: any up push scrolls forward at the max speed, any down push
scrolls backward, centered holds. In QJoyControl, bind the **Left stick** so pushing it
up sends the **Up arrow** key and pushing it down sends the **Down arrow** key (use
QJoyControl's stick-direction / threshold binding, not the analog-mouse feature). Leave
**analog mouse** and **gyro mouse** disabled.
```

- [ ] **Step 2: Update QJOYCONTROL-SETUP.md — section 3 (mapping table)**

Replace this block:

```markdown
## 3. Map the buttons to these keys
Configure QJoyControl's button-to-key mapping for the Left JoyCon as follows:

| Left JoyCon input | Key | Teleprompter action        |
|-------------------|-----|----------------------------|
| D-pad Up          | i   | Increase max scroll speed  |
| D-pad Down        | k   | Decrease max scroll speed  |
| D-pad Left        | j   | Seek back one paragraph    |
| D-pad Right       | l   | Seek forward one paragraph |
| SL                | q   | Text size down             |
| SR                | e   | Text size up               |
| ZL                | z   | Toggle cruise (auto-scroll)|

(These keys are defined in `src/config.ts` as `CONFIG.keyMap` — change both places
if you prefer different keys.)
```

with:

```markdown
## 3. Map the inputs to these keys
Configure QJoyControl's input-to-key mapping for the Left JoyCon as follows:

| Left JoyCon input | Key | Teleprompter action         |
|-------------------|-----|-----------------------------|
| Stick Up          | ↑   | Scroll forward (max speed)  |
| Stick Down        | ↓   | Scroll backward (max speed) |
| D-pad Up          | i   | Increase max scroll speed   |
| D-pad Down        | k   | Decrease max scroll speed   |
| D-pad Left        | j   | Seek back one paragraph     |
| D-pad Right       | l   | Seek forward one paragraph  |
| SL                | q   | Text size down              |
| SR                | e   | Text size up                |
| ZL                | z   | Toggle cruise (auto-scroll) |

(The button keys are defined in `src/config.ts` as `CONFIG.keyMap`; the throttle uses the
fixed Arrow Up / Arrow Down keys. Change both here and in the app if you prefer different
keys.)
```

- [ ] **Step 3: Update QJOYCONTROL-SETUP.md — section 4 (use it) and Tuning**

Replace this block:

```markdown
## 4. Use it
1. Open the teleprompter (`npm run dev`, then the printed URL) and load a PDF.
2. **Click the text area once** to engage Pointer Lock (this lets the browser read
   the stick-as-mouse without the cursor hitting screen edges). Press **Esc** to
   release; click again to re-engage. The HUD shows "Controller ●" when engaged.
3. Drive it:
   - **Stick up / down** — scroll forward / reverse; how far you push sets the speed.
   - **ZL** — toggle cruise (hands-free scroll at the max speed).
   - **D-pad up / down** — increase / decrease max scroll speed.
   - **D-pad left / right** — seek by paragraph; **SL / SR** — text size down / up.

## Tuning
If the throttle feels too fast/slow, adjust QJoyControl's analog sensitivity and/or
`CONFIG.mouseFullThrottleRate` in `src/config.ts` (the mouse rate that equals full
throttle). If up/down are reversed, set `CONFIG.invertThrottle = true`.
```

with:

```markdown
## 4. Use it
1. Open the teleprompter (`npm run dev`, then the printed URL) and load a PDF.
2. Drive it (no engage step — the app responds to input immediately):
   - **Stick up / down** — scroll forward / reverse at the max speed (release to hold).
   - **ZL** — toggle cruise (hands-free scroll at the max speed).
   - **D-pad up / down** — increase / decrease max scroll speed.
   - **D-pad left / right** — seek by paragraph; **SL / SR** — text size down / up.

## Tuning
The throttle is binary, so there is no speed sensitivity to tune — set the pace with the
D-pad (max speed) and ZL (cruise). If the stick's up/down don't register reliably, adjust
QJoyControl's stick-direction threshold. Up is always forward, so there is no invert
setting.
```

- [ ] **Step 4: Update README.md — intro paragraphs**

Replace this block:

```markdown
A browser-based teleprompter you drive with a Nintendo Switch **Left JoyCon**. Load a
PDF, and its text is reflowed into large, centered, vertically-scrolling copy. The
analog stick acts as a proportional **throttle** (push up to scroll forward, down to
reverse, further = faster); ZL toggles hands-free **cruise**; the D-pad and
shoulder buttons handle max speed, paragraph seeking, and text size.

Input comes from an **unmodified** [QJoyControl](https://github.com/erikmwerner/QJoyControl):
the app uses QJoyControl's built-in *analog-stick → mouse* feature (captured in the
browser via the Pointer Lock API and interpreted as a throttle) and its
*button → keyboard key* mapping. **No custom QJoyControl build is required.**
```

with:

```markdown
A browser-based teleprompter you drive with a Nintendo Switch **Left JoyCon**. Load a
PDF, and its text is reflowed into large, centered, vertically-scrolling copy. The
analog stick acts as a binary **throttle** (push up to scroll forward, down to reverse,
both at the max speed); ZL toggles hands-free **cruise**; the D-pad and shoulder buttons
handle max speed, paragraph seeking, and text size.

Input comes from an **unmodified** [QJoyControl](https://github.com/erikmwerner/QJoyControl):
it maps every JoyCon input to a keyboard key — the stick's up/down to the arrow keys and
the buttons to letter keys. **No custom QJoyControl build is required.**
```

- [ ] **Step 5: Update README.md — Features list**

Replace this block:

```markdown
- PDF text extraction and reflow into a clean teleprompter column
- Proportional throttle scrolling (forward/reverse) with a center deadzone
- Hands-free cruise mode at an adjustable max speed
- Text-size and per-paragraph seek controls
- On-screen HUD: controller status, scroll state, max speed, text size, progress
- Hardware-free keyboard mode for development and testing
```

with:

```markdown
- PDF text extraction and reflow into a clean teleprompter column
- Binary throttle scrolling — forward/reverse at the max speed
- Hands-free cruise mode at an adjustable max speed
- Text-size and per-paragraph seek controls
- On-screen HUD: scroll state, max speed, text size, progress
- Runs entirely from the keyboard, so it works with or without a JoyCon
```

- [ ] **Step 6: Update README.md — Prerequisites and Launch steps**

Replace this line:

```markdown
- A modern browser (Pointer Lock + ES modules)
```

with:

```markdown
- A modern browser (ES modules)
```

Then replace this block:

```markdown
1. **Load a PDF** — drag a PDF onto the window, or click to choose one.
2. **Engage the controller** — click the text area once to enable Pointer Lock
   (this lets the browser read the stick-as-mouse without the cursor hitting screen
   edges). Press **Esc** to release; click again to re-engage. The HUD reads
   **"Controller ●"** when engaged.

> Requires QJoyControl configured per [QJOYCONTROL-SETUP.md](./QJOYCONTROL-SETUP.md).
```

with:

```markdown
1. **Load a PDF** — drag a PDF onto the window, or click to choose one.
2. **Drive it** — use the JoyCon (or the keyboard keys below). There is no engage step;
   the app responds to input immediately.

> For JoyCon use, configure QJoyControl per [QJOYCONTROL-SETUP.md](./QJOYCONTROL-SETUP.md).
```

- [ ] **Step 7: Update README.md — keyboard section**

Replace this block:

````markdown
### Try it without a JoyCon (keyboard mode)

Open the app with `?input=keyboard`:

```
http://localhost:5173/?input=keyboard
```

| Key         | Action                         |
|-------------|--------------------------------|
| ↑ / ↓       | Throttle forward / reverse     |
| `z`         | Toggle cruise                  |
| `i` / `k`   | Increase / decrease max speed  |
| `j` / `l`   | Seek back / forward a paragraph|
| `q` / `e`   | Text size down / up            |
````

with:

````markdown
### Keyboard keys

The app is always keyboard-driven (QJoyControl just sends these keys), so you can use it
without a JoyCon:

| Key         | Action                                 |
|-------------|----------------------------------------|
| ↑ / ↓       | Throttle forward / reverse (max speed) |
| `z`         | Toggle cruise                          |
| `i` / `k`   | Increase / decrease max speed          |
| `j` / `l`   | Seek back / forward a paragraph        |
| `q` / `e`   | Text size down / up                    |
````

- [ ] **Step 8: Update README.md — Controls table and scroll behavior**

Replace this block:

```markdown
| Stick ▲ / ▼  | Throttle: scroll forward / reverse (proportional) |
| ZL           | Toggle cruise (hands-free at max speed)        |
| D-pad ▲ / ▼  | Increase / decrease max scroll speed           |
| D-pad ◀ / ▶  | Seek back / forward one paragraph              |
| SL / SR      | Text size down / up                            |

**Scroll behavior:** centering the stick holds position. Pressing ZL starts
cruise; pressing again pauses; nudging the stick during cruise hands control back to
manual. See [QJOYCONTROL-SETUP.md](./QJOYCONTROL-SETUP.md) for the QJoyControl
button-to-key mapping this expects.
```

with:

```markdown
| Stick ▲ / ▼  | Throttle: scroll forward / reverse at max speed |
| ZL           | Toggle cruise (hands-free at max speed)        |
| D-pad ▲ / ▼  | Increase / decrease max scroll speed           |
| D-pad ◀ / ▶  | Seek back / forward one paragraph              |
| SL / SR      | Text size down / up                            |

**Scroll behavior:** centering the stick holds position; pushing up or down scrolls at the
max speed. Pressing ZL starts cruise; pressing again pauses; nudging the stick during
cruise hands control back to manual. See [QJOYCONTROL-SETUP.md](./QJOYCONTROL-SETUP.md) for
the QJoyControl key mapping this expects.
```

- [ ] **Step 9: Update README.md — Configuration table**

Replace this block:

```markdown
| `mouseFullThrottleRate` | Mouse-movement rate (px/s) that maps to full throttle. Tune together with QJoyControl's analog sensitivity. |
| `invertThrottle` | Set `true` if up/down feel reversed. |
| `deadzone` | Ignores small stick/mouse jitter near center. |
```

with:

```markdown
| `deadzone` | Ignores tiny throttle jitter near center. |
```

- [ ] **Step 10: Update README.md — Project structure and input-flow diagram**

Replace this block:

```markdown
│   ├── hud/Hud.ts                    # status overlay
│   └── input/
│       ├── InputSource.ts            # source interface
│       ├── mouseRateToStick.ts       # mouse-rate → normalized throttle
│       ├── QJoyControlInputSource.ts # Pointer Lock + mapped keys (default)
│       └── KeyboardInputSource.ts    # keyboard dev/test source
```

with:

```markdown
│   ├── hud/Hud.ts                    # status overlay
│   └── input/
│       ├── InputSource.ts            # source interface
│       └── KeyInputSource.ts         # key events (QJoyControl or keyboard) → InputFrame
```

Then replace this block:

````markdown
```
Left JoyCon ──▶ QJoyControl (unmodified) ──▶ OS mouse + key events ──▶ Browser
                                                                        │
   stick → mouse ─(Pointer Lock movementY)→ mouseRateToStick → stick.y  │
   buttons → keys ─(keydown/keyup)────────→ ButtonState               ──┴─▶ ScrollEngine + DocumentView
```
````

with:

````markdown
```
Left JoyCon ──▶ QJoyControl (unmodified) ──▶ OS key events ──▶ Browser
                                                                │
   stick up/down → ↑/↓ keys ─(keydown/keyup)→ stick.y ∈ {-1,0,1} │
   buttons       → letter keys ─────────────→ ButtonState        ─┴─▶ ScrollEngine + DocumentView
```
````

- [ ] **Step 11: Final sanity check and commit**

Run: `npm test`
Expected: full suite PASS.

Run: `grep -rn "mouseFullThrottleRate\|invertThrottle\|Pointer Lock\|input=keyboard\|KeyboardInputSource\|QJoyControlInputSource\|mouseRateToStick" README.md QJOYCONTROL-SETUP.md src`
Expected: no matches (all stale references removed).

```bash
git add -A
git commit -m "docs: update README and QJoyControl setup for binary throttle"
```

---

## Notes

- **ScrollEngine is intentionally untouched.** `applyDeadzone(1, 0.08) === 1`, so `deflection * maxSpeed` with `stick.y ∈ {-1, 0, 1}` already produces `±maxSpeed` or `0`. Its existing tests continue to pass and cover this behavior.
- **Cruise, seek, text-size, and max-speed controls are unchanged.** This plan only touches the throttle path and the input plumbing that supported it.
- **Dead CSS:** `styles.css` may contain `.hud-item.ok` / `.hud-item.bad` rules that are now unused. Harmless; left in place (out of scope for this change).
