# JoyCon WebHID Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read the Left JoyCon directly over WebHID (buttons + analog stick via the full-report-mode handshake) to drive the binary throttle, replacing QJoyControl entirely, with the keyboard kept as a fallback.

**Architecture:** A new `JoyConHidInputSource` produces the existing `InputFrame`; pure decoders live in `joyconReport.ts` (unit-tested); a `CompositeInputSource` merges the JoyCon and keyboard sources. `ControlMapper`, `ScrollEngine`, and `types.ts` are unchanged. A minimal ambient `webhid.d.ts` supplies WebHID types (no npm dependency).

**Tech Stack:** TypeScript · Vite · Vitest (jsdom, globals) · WebHID (Chromium)

**Design doc:** [docs/superpowers/specs/2026-07-03-joycon-webhid-input-design.md](../specs/2026-07-03-joycon-webhid-input-design.md)

---

## File overview

- `src/input/joyconReport.ts` (new) — pure decoders + protocol constants; unit-tested.
- `src/input/joyconReport.test.ts` (new) — decoder tests over synthetic report bytes.
- `src/input/CompositeInputSource.ts` (new) — merges multiple `InputSource`s; unit-tested.
- `src/input/CompositeInputSource.test.ts` (new).
- `src/input/webhid.d.ts` (new) — minimal ambient WebHID type declarations.
- `src/input/JoyConHidInputSource.ts` (new) — thin WebHID I/O shell (no unit test; manual).
- `src/config.ts` (modify) — add `stickThreshold`, `invertThrottle`.
- `src/hud/Hud.ts` (modify) — re-add the `connected` field + "Joy-Con ●/○" indicator.
- `src/styles.css` (modify) — restore `.hud-item.ok/.bad`; style `#connect-joycon`.
- `index.html` (modify) — add the `#connect-joycon` button.
- `src/main.ts` (modify) — build the composite, wire the connect button + HUD indicator.
- `README.md` (modify) + `QJOYCONTROL-SETUP.md` → `JOYCON-SETUP.md` (rename + rewrite).

Note on offsets: WebHID delivers the input report **with the reportId byte stripped**, so all byte indices below are one less than the public reverse-engineering docs (which count the reportId at index 0).

---

## Task 1: JoyCon report decoders (TDD)

**Files:**
- Create: `src/input/joyconReport.ts`
- Test: `src/input/joyconReport.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/input/joyconReport.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  STICK_CENTER,
  decodeButtons,
  decodeThrottle,
  fullReportModeReport,
} from './joyconReport';

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

describe('decodeThrottle', () => {
  const opts = { threshold: 700, invert: false };
  it('returns 0 at rest (center)', () => {
    expect(decodeThrottle(report({ vertical: STICK_CENTER }), opts)).toBe(0);
  });
  it('returns +1 when pushed well above center', () => {
    expect(decodeThrottle(report({ vertical: STICK_CENTER + 900 }), opts)).toBe(1);
  });
  it('returns -1 when pushed well below center', () => {
    expect(decodeThrottle(report({ vertical: STICK_CENTER - 900 }), opts)).toBe(-1);
  });
  it('returns 0 within the threshold deadzone', () => {
    expect(decodeThrottle(report({ vertical: STICK_CENTER + 100 }), opts)).toBe(0);
  });
  it('flips direction when invert is true', () => {
    expect(decodeThrottle(report({ vertical: STICK_CENTER + 900 }), { threshold: 700, invert: true })).toBe(-1);
  });
});

describe('fullReportModeReport', () => {
  it('builds the 0x01 output payload with the packet nibble and 0x03/0x30 subcommand', () => {
    expect(Array.from(fullReportModeReport(1))).toEqual([
      1, 0x00, 0x01, 0x40, 0x40, 0x00, 0x01, 0x40, 0x40, 0x03, 0x30,
    ]);
  });
  it('masks the packet number to its low nibble', () => {
    expect(fullReportModeReport(0x11)[0]).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/input/joyconReport.test.ts`
Expected: FAIL — cannot resolve `'./joyconReport'`.

- [ ] **Step 3: Write the implementation**

Create `src/input/joyconReport.ts`:

```ts
import type { ButtonState } from '../types';

/** Nintendo vendor id and the Left JoyCon product id (WebHID device filter). */
export const NINTENDO_VENDOR_ID = 0x057e;
export const JOYCON_L_PRODUCT_ID = 0x2006;

/** Nominal analog-stick center for a 12-bit axis (0..4095). Binary throttle needs no calibration. */
export const STICK_CENTER = 2048;

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

/**
 * Decode the vertical stick value into a binary throttle direction.
 * The 12-bit vertical axis is packed across bytes 6 (high nibble) and 7.
 */
export function decodeThrottle(
  data: DataView,
  opts: { threshold: number; invert: boolean },
): -1 | 0 | 1 {
  const vertical = (data.getUint8(6) >> 4) | (data.getUint8(7) << 4);
  const delta = vertical - STICK_CENTER;
  let dir: -1 | 0 | 1 = 0;
  if (delta > opts.threshold) dir = 1;
  else if (delta < -opts.threshold) dir = -1;
  return opts.invert ? ((-dir) as -1 | 0 | 1) : dir;
}

/**
 * Output report 0x01 payload that switches the JoyCon into standard full report mode (0x30):
 * a packet counter (low nibble), the neutral-rumble preamble, then subcommand 0x03 arg 0x30.
 */
export function fullReportModeReport(packetNumber: number): Uint8Array {
  return new Uint8Array([
    packetNumber & 0x0f,
    0x00, 0x01, 0x40, 0x40, 0x00, 0x01, 0x40, 0x40,
    0x03,
    0x30,
  ]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/input/joyconReport.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc --noEmit -p tsconfig.build.json`
Expected: exit 0.

```bash
git add src/input/joyconReport.ts src/input/joyconReport.test.ts
git commit -m "feat: pure JoyCon HID report decoders"
```

---

## Task 2: CompositeInputSource (TDD)

**Files:**
- Create: `src/input/CompositeInputSource.ts`
- Test: `src/input/CompositeInputSource.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/input/CompositeInputSource.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CompositeInputSource } from './CompositeInputSource';
import { NEUTRAL_FRAME, type InputFrame } from '../types';
import type { InputSource } from './InputSource';

function fakeSource(frame: Partial<InputFrame>): InputSource & { started: boolean } {
  const full: InputFrame = {
    stick: { x: 0, y: 0, ...(frame.stick ?? {}) },
    buttons: { ...NEUTRAL_FRAME.buttons, ...(frame.buttons ?? {}) },
  };
  return {
    started: false,
    start() { this.started = true; },
    stop() { this.started = false; },
    getFrame: () => full,
  };
}

describe('CompositeInputSource', () => {
  it('starts and stops every child source', () => {
    const a = fakeSource({});
    const b = fakeSource({});
    const c = new CompositeInputSource([a, b]);
    c.start();
    expect([a.started, b.started]).toEqual([true, true]);
    c.stop();
    expect([a.started, b.started]).toEqual([false, false]);
  });
  it('ORs buttons across sources', () => {
    const c = new CompositeInputSource([
      fakeSource({ buttons: { zl: true } }),
      fakeSource({ buttons: { up: true } }),
    ]);
    const f = c.getFrame();
    expect(f.buttons.zl).toBe(true);
    expect(f.buttons.up).toBe(true);
  });
  it('uses the first non-zero stick.y in source order', () => {
    const c = new CompositeInputSource([
      fakeSource({ stick: { x: 0, y: 0 } }),
      fakeSource({ stick: { x: 0, y: -1 } }),
    ]);
    expect(c.getFrame().stick.y).toBe(-1);
  });
  it('reports stick.y 0 when no source is deflected', () => {
    const c = new CompositeInputSource([fakeSource({}), fakeSource({})]);
    expect(c.getFrame().stick.y).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/input/CompositeInputSource.test.ts`
Expected: FAIL — cannot resolve `'./CompositeInputSource'`.

- [ ] **Step 3: Write the implementation**

Create `src/input/CompositeInputSource.ts`:

```ts
import type { InputFrame, ButtonState } from '../types';
import { NEUTRAL_FRAME } from '../types';
import type { InputSource } from './InputSource';

/**
 * Merges several input sources into one frame: buttons are OR'd across all
 * sources, and stick.y is taken from the first source (in constructor order)
 * that is deflected. Lets the JoyCon and keyboard drive the app simultaneously.
 */
export class CompositeInputSource implements InputSource {
  constructor(private sources: InputSource[]) {}

  start(): void {
    for (const s of this.sources) s.start();
  }

  stop(): void {
    for (const s of this.sources) s.stop();
  }

  getFrame(): InputFrame {
    const buttons: ButtonState = { ...NEUTRAL_FRAME.buttons };
    let stickY = 0;
    for (const s of this.sources) {
      const f = s.getFrame();
      for (const key of Object.keys(buttons) as (keyof ButtonState)[]) {
        if (f.buttons[key]) buttons[key] = true;
      }
      if (stickY === 0 && f.stick.y !== 0) stickY = f.stick.y;
    }
    return { stick: { x: 0, y: stickY }, buttons };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/input/CompositeInputSource.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc --noEmit -p tsconfig.build.json`
Expected: exit 0.

```bash
git add src/input/CompositeInputSource.ts src/input/CompositeInputSource.test.ts
git commit -m "feat: composite input source merging keyboard and JoyCon"
```

---

## Task 3: WebHID types, config, and the JoyCon input source

**Files:**
- Create: `src/input/webhid.d.ts`
- Create: `src/input/JoyConHidInputSource.ts`
- Modify: `src/config.ts`

This source is a browser+hardware I/O shell and is not unit-tested (the design specifies hands-on verification). The gate for this task is a clean type-check.

- [ ] **Step 1: Add minimal WebHID type declarations**

Create `src/input/webhid.d.ts` (ambient global declarations — no imports/exports, so it augments the global scope; covers only the surface this app uses):

```ts
// Minimal WebHID declarations — only what this app uses.
// Full spec: https://wicg.github.io/webhid/
interface HIDDevice extends EventTarget {
  readonly opened: boolean;
  readonly vendorId: number;
  readonly productId: number;
  readonly productName: string;
  open(): Promise<void>;
  close(): Promise<void>;
  sendReport(reportId: number, data: BufferSource): Promise<void>;
  addEventListener(type: 'inputreport', listener: (e: HIDInputReportEvent) => void): void;
  removeEventListener(type: 'inputreport', listener: (e: HIDInputReportEvent) => void): void;
}

interface HIDInputReportEvent extends Event {
  readonly device: HIDDevice;
  readonly reportId: number;
  readonly data: DataView;
}

interface HIDConnectionEvent extends Event {
  readonly device: HIDDevice;
}

interface HIDDeviceFilter {
  vendorId?: number;
  productId?: number;
}

interface HID extends EventTarget {
  getDevices(): Promise<HIDDevice[]>;
  requestDevice(options: { filters: HIDDeviceFilter[] }): Promise<HIDDevice[]>;
  addEventListener(type: 'connect' | 'disconnect', listener: (e: HIDConnectionEvent) => void): void;
  removeEventListener(type: 'connect' | 'disconnect', listener: (e: HIDConnectionEvent) => void): void;
}

interface Navigator {
  readonly hid?: HID;
}
```

- [ ] **Step 2: Add the tunable config fields**

In `src/config.ts`, replace this block:

```ts
export const CONFIG = {
  // Scroll throttle
  deadzone: 0.08,
```

with:

```ts
export const CONFIG = {
  // Scroll throttle
  deadzone: 0.08,
  stickThreshold: 700,   // raw JoyCon stick units from center to trigger the binary throttle
  invertThrottle: false, // flip if pushing the stick up scrolls the wrong way
```

- [ ] **Step 3: Write the JoyCon input source**

Create `src/input/JoyConHidInputSource.ts`:

```ts
import type { InputFrame } from '../types';
import { NEUTRAL_FRAME } from '../types';
import type { InputSource } from './InputSource';
import { CONFIG } from '../config';
import {
  NINTENDO_VENDOR_ID,
  JOYCON_L_PRODUCT_ID,
  decodeButtons,
  decodeThrottle,
  fullReportModeReport,
} from './joyconReport';

const FULL_REPORT_ID = 0x30;
const OUTPUT_REPORT_ID = 0x01;

/**
 * Reads a Left JoyCon directly over WebHID. On the first connect the user must
 * click (WebHID requires a gesture); afterwards getDevices() reconnects silently.
 * When WebHID is unavailable the source is inert and the keyboard fallback drives the app.
 */
export class JoyConHidInputSource implements InputSource {
  private frame: InputFrame = structuredClone(NEUTRAL_FRAME);
  private device: HIDDevice | null = null;
  private packet = 0;

  private onInputReport = (e: HIDInputReportEvent): void => {
    if (e.reportId !== FULL_REPORT_ID) return;
    this.frame.buttons = decodeButtons(e.data);
    this.frame.stick.y = decodeThrottle(e.data, {
      threshold: CONFIG.stickThreshold,
      invert: CONFIG.invertThrottle,
    });
  };

  private onDisconnect = (e: HIDConnectionEvent): void => {
    if (e.device === this.device) this.reset();
  };

  getFrame(): InputFrame {
    return this.frame;
  }

  isConnected(): boolean {
    return this.device?.opened ?? false;
  }

  start(): void {
    const hid = navigator.hid;
    if (!hid) return; // WebHID unsupported — keyboard fallback still works
    hid.addEventListener('disconnect', this.onDisconnect);
    void hid.getDevices().then((devices) => {
      const existing = devices.find(
        (d) => d.vendorId === NINTENDO_VENDOR_ID && d.productId === JOYCON_L_PRODUCT_ID,
      );
      if (existing) void this.initDevice(existing);
    });
  }

  /** Must be called from a user gesture (the Connect button click). */
  async connect(): Promise<void> {
    const hid = navigator.hid;
    if (!hid) return;
    const [device] = await hid.requestDevice({
      filters: [{ vendorId: NINTENDO_VENDOR_ID, productId: JOYCON_L_PRODUCT_ID }],
    });
    if (device) await this.initDevice(device);
  }

  stop(): void {
    const hid = navigator.hid;
    if (hid) hid.removeEventListener('disconnect', this.onDisconnect);
    if (this.device) void this.device.close();
    this.reset();
  }

  private async initDevice(device: HIDDevice): Promise<void> {
    this.device = device;
    if (!device.opened) await device.open();
    device.addEventListener('inputreport', this.onInputReport);
    this.packet = (this.packet + 1) & 0x0f;
    await device.sendReport(OUTPUT_REPORT_ID, fullReportModeReport(this.packet));
  }

  private reset(): void {
    if (this.device) this.device.removeEventListener('inputreport', this.onInputReport);
    this.device = null;
    this.frame = structuredClone(NEUTRAL_FRAME);
  }
}
```

- [ ] **Step 4: Type-check and run the suite**

Run: `npx tsc --noEmit -p tsconfig.build.json`
Expected: exit 0.

Run: `npm test`
Expected: full suite PASS (no new tests here; existing ones unaffected).

- [ ] **Step 5: Commit**

```bash
git add src/input/webhid.d.ts src/input/JoyConHidInputSource.ts src/config.ts
git commit -m "feat: JoyCon WebHID input source + throttle config"
```

---

## Task 4: Wire the JoyCon source into the app

**Files:**
- Modify: `index.html`
- Modify: `src/hud/Hud.ts`
- Modify: `src/styles.css`
- Modify: `src/main.ts`

- [ ] **Step 1: Add the Connect button to index.html**

In `index.html`, replace:

```html
    <div id="drop-zone">Drag a PDF here, or click to choose a file</div>
```

with:

```html
    <button id="connect-joycon" hidden>Connect Joy-Con</button>
    <div id="drop-zone">Drag a PDF here, or click to choose a file</div>
```

- [ ] **Step 2: Re-add the HUD connection indicator**

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
      <span class="hud-item ${m.connected ? 'ok' : 'bad'}">${m.connected ? 'Joy-Con ●' : 'Joy-Con ○'}</span>
      <span class="hud-item">${stateLabel(m.state)}</span>
      <span class="hud-item">Max ${Math.round(m.maxSpeed)} px/s</span>
      <span class="hud-item">Text ${Math.round(m.fontSize)} px</span>
      <span class="hud-item">${pct}%</span>
    `;
  }
}
```

- [ ] **Step 3: Restore indicator CSS and style the Connect button**

In `src/styles.css`, replace:

```css
.hud-item { color: #cfd8e3; }
```

with:

```css
.hud-item { color: #cfd8e3; }
.hud-item.ok { color: #7fd88f; }
.hud-item.bad { color: #e08080; }

#connect-joycon {
  position: fixed; top: 12px; right: 12px; z-index: 20;
  padding: 8px 14px; border: 0; border-radius: 6px; cursor: pointer;
  background: #2b6cb0; color: #fff; font: 14px system-ui, sans-serif;
}
#connect-joycon[hidden] { display: none; }
```

- [ ] **Step 4: Wire the composite, connect button, and HUD field in main.ts**

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
import { JoyConHidInputSource } from './input/JoyConHidInputSource';
import { CompositeInputSource } from './input/CompositeInputSource';

const scroller = document.getElementById('scroller') as HTMLElement;
const docEl = document.getElementById('doc') as HTMLElement;
const dropZone = document.getElementById('drop-zone') as HTMLElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const hudEl = document.getElementById('hud') as HTMLElement;
const connectBtn = document.getElementById('connect-joycon') as HTMLButtonElement;

const view = new DocumentView(docEl);
const engine = new ScrollEngine();
const mapper = new ControlMapper();
const hud = new Hud(hudEl);

const joycon = new JoyConHidInputSource();
const source = new CompositeInputSource([joycon, new KeyInputSource()]);
source.start();

connectBtn.addEventListener('click', () => { void joycon.connect(); });

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

  const connected = joycon.isConnected();
  connectBtn.hidden = !navigator.hid || connected;

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
    connected,
    state: engine.state,
    maxSpeed: engine.maxSpeed,
    fontSize,
    progress: maxScroll > 0 ? pos / maxScroll : 0,
  });

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
```

- [ ] **Step 5: Type-check, test, build**

Run: `npx tsc --noEmit -p tsconfig.build.json`
Expected: exit 0.

Run: `npm test`
Expected: full suite PASS (Hud's `stateLabel` test unaffected).

Run: `npm run build`
Expected: build succeeds (tsc + vite bundle emitted).

- [ ] **Step 6: Commit**

```bash
git add index.html src/hud/Hud.ts src/styles.css src/main.ts
git commit -m "feat: wire JoyCon WebHID source, connect button, and HUD indicator"
```

---

## Task 5: Documentation

**Files:**
- Rename + rewrite: `QJOYCONTROL-SETUP.md` → `JOYCON-SETUP.md`
- Modify: `README.md`

Docs-only; no tests to run beyond a final grep + suite sanity check.

- [ ] **Step 1: Rename the setup guide**

```bash
git mv QJOYCONTROL-SETUP.md JOYCON-SETUP.md
```

- [ ] **Step 2: Replace JOYCON-SETUP.md contents**

Replace the entire contents of `JOYCON-SETUP.md` with:

```markdown
# Connecting a Left JoyCon over WebHID

The teleprompter reads the JoyCon directly in the browser via the WebHID API — no driver,
no helper app, no QJoyControl.

## Requirements
- A **Chromium browser** (Chrome or Edge). WebHID is unavailable in Firefox and Safari; use
  the keyboard controls there instead.
- A Nintendo Switch **Left JoyCon**.

## 1. Pair the JoyCon over Bluetooth
Hold the small round **sync** button on the JoyCon's rail until the lights flash, then pair
it from your OS Bluetooth settings (it shows up as "Joy-Con (L)"). This is a one-time step.

## 2. Connect it in the app
1. Open the teleprompter (`npm run dev`, then the printed URL) and load a PDF.
2. Click **Connect Joy-Con** (top-right) and pick "Joy-Con (L)" in the browser's device
   picker. The HUD reads **"Joy-Con ●"** once connected.
3. On later visits the app reconnects automatically — no click needed.

## 3. Controls
- **Stick up / down** — scroll forward / reverse at the max speed (release to hold).
- **ZL** — toggle cruise (hands-free scroll at the max speed).
- **D-pad up / down** — increase / decrease max scroll speed.
- **D-pad left / right** — seek by paragraph; **SL / SR** — text size down / up.

## Tuning
The stick is a binary throttle. If pushing up scrolls the wrong way, set
`CONFIG.invertThrottle = true` in `src/config.ts`. If it triggers too easily or needs too
big a push, adjust `CONFIG.stickThreshold` (raw stick units from center; larger = firmer
push required).

## Troubleshooting
- **No "Connect Joy-Con" button:** your browser lacks WebHID — use Chrome/Edge, or the
  keyboard controls.
- **Device picker is empty:** confirm the JoyCon is paired in your OS Bluetooth settings and
  that no other app (QJoyControl, a Switch emulator) is holding it.
- **Buttons work but the stick does nothing:** the JoyCon may not have entered full report
  mode — disconnect and reconnect with the button.
```

- [ ] **Step 3: Update README.md — intro paragraph**

Replace:

```markdown
Input comes from an **unmodified** [QJoyControl](https://github.com/erikmwerner/QJoyControl):
it maps every JoyCon input to a keyboard key — the stick's up/down to the arrow keys and
the buttons to letter keys. **No custom QJoyControl build is required.**
```

with:

```markdown
Input comes **directly from the JoyCon** over the browser's [WebHID API](https://developer.mozilla.org/en-US/docs/Web/API/WebHID_API) —
no driver or helper app. Click **Connect Joy-Con** once and the app reads the stick and
buttons straight from the controller. A keyboard fallback works in any browser.
```

- [ ] **Step 4: Update README.md — Features and Prerequisites**

Replace:

```markdown
- Runs entirely from the keyboard, so it works with or without a JoyCon
```

with:

```markdown
- Reads the JoyCon directly over WebHID (Chromium), with a keyboard fallback everywhere
```

Then replace:

```markdown
- A modern browser (ES modules)
- For controller use: a Left JoyCon and QJoyControl (see [QJOYCONTROL-SETUP.md](./QJOYCONTROL-SETUP.md))
```

with:

```markdown
- A modern browser (ES modules). For JoyCon use: a Chromium browser (Chrome/Edge) with WebHID
- A Left JoyCon paired over Bluetooth (see [JOYCON-SETUP.md](./JOYCON-SETUP.md))
```

- [ ] **Step 5: Update README.md — Launch steps**

Replace:

```markdown
1. **Load a PDF** — drag a PDF onto the window, or click to choose one.
2. **Drive it** — use the JoyCon (or the keyboard keys below). There is no engage step;
   the app responds to input immediately.

> For JoyCon use, configure QJoyControl per [QJOYCONTROL-SETUP.md](./QJOYCONTROL-SETUP.md).
```

with:

```markdown
1. **Load a PDF** — drag a PDF onto the window, or click to choose one.
2. **Connect the JoyCon** — click **Connect Joy-Con** (top-right) once and pick the Left
   JoyCon. After the first grant the browser reconnects automatically on reload; the HUD
   shows **"Joy-Con ●"** when connected. Or skip it and use the keyboard keys below.

> For pairing and browser details, see [JOYCON-SETUP.md](./JOYCON-SETUP.md).
```

- [ ] **Step 6: Update README.md — keyboard section blurb**

Replace:

```markdown
The app is always keyboard-driven (QJoyControl just sends these keys), so you can use it
without a JoyCon:
```

with:

```markdown
The keyboard is always active as a fallback, so you can use the app without a JoyCon:
```

- [ ] **Step 7: Update README.md — scroll-behavior paragraph**

Replace:

```markdown
cruise hands control back to manual. See [QJOYCONTROL-SETUP.md](./QJOYCONTROL-SETUP.md) for
the QJoyControl key mapping this expects.
```

with:

```markdown
cruise hands control back to manual. See [JOYCON-SETUP.md](./JOYCON-SETUP.md) for pairing
and connection details.
```

- [ ] **Step 8: Update README.md — Configuration table**

Replace:

```markdown
| `deadzone` | Ignores tiny throttle jitter near center. |
| `minMaxSpeed` / `maxMaxSpeed` / `maxSpeedStep` / `initialMaxSpeed` | Scroll speed range and SL/SR step. |
| `minFontSize` / `maxFontSize` / `fontSizeStep` / `initialFontSize` | Text size range and D-pad step. |
| `hudHideMs` | How long before the HUD fades after inactivity. |
| `keyMap` | Keys the app listens for → controller actions. Change here **and** in QJoyControl if you want different keys. |
```

with:

```markdown
| `deadzone` | Ignores tiny throttle jitter near center. |
| `stickThreshold` | How far the JoyCon stick must move from center (raw units) to trigger the binary throttle. |
| `invertThrottle` | Flip if pushing the stick up scrolls the wrong way. |
| `minMaxSpeed` / `maxMaxSpeed` / `maxSpeedStep` / `initialMaxSpeed` | Scroll speed range and D-pad step. |
| `minFontSize` / `maxFontSize` / `fontSizeStep` / `initialFontSize` | Text size range and SL/SR step. |
| `hudHideMs` | How long before the HUD fades after inactivity. |
| `keyMap` | Keyboard-fallback keys → controller actions. |
```

- [ ] **Step 9: Update README.md — Project structure**

Replace:

```markdown
├── index.html                 # app shell (drop zone, scroller, HUD)
├── QJOYCONTROL-SETUP.md        # one-time QJoyControl configuration guide
├── src/
│   ├── main.ts                # wiring + requestAnimationFrame loop
│   ├── config.ts              # tunable constants + keyMap
│   ├── types.ts               # InputFrame, Command, ScrollState, …
│   ├── control/ControlMapper.ts      # button edge-detection → commands
│   ├── scroll/throttle.ts            # applyDeadzone
│   ├── scroll/ScrollEngine.ts        # HOLD/MANUAL/CRUISE state + velocity
│   ├── document/paragraphs.ts        # text extraction + seek helpers
│   ├── document/DocumentView.ts      # PDF.js load + reflow + font size
│   ├── hud/Hud.ts                    # status overlay
│   └── input/
│       ├── InputSource.ts            # source interface
│       └── KeyInputSource.ts         # key events (QJoyControl or keyboard) → InputFrame
```

with:

```markdown
├── index.html                 # app shell (drop zone, scroller, HUD, connect button)
├── JOYCON-SETUP.md             # JoyCon pairing + WebHID connection guide
├── src/
│   ├── main.ts                # wiring + requestAnimationFrame loop
│   ├── config.ts              # tunable constants + keyMap
│   ├── types.ts               # InputFrame, Command, ScrollState, …
│   ├── control/ControlMapper.ts      # button edge-detection → commands
│   ├── scroll/throttle.ts            # applyDeadzone
│   ├── scroll/ScrollEngine.ts        # HOLD/MANUAL/CRUISE state + velocity
│   ├── document/paragraphs.ts        # text extraction + seek helpers
│   ├── document/DocumentView.ts      # PDF.js load + reflow + font size
│   ├── hud/Hud.ts                    # status overlay
│   └── input/
│       ├── InputSource.ts            # source interface
│       ├── KeyInputSource.ts         # keyboard → InputFrame (fallback)
│       ├── JoyConHidInputSource.ts   # WebHID JoyCon → InputFrame
│       ├── CompositeInputSource.ts   # merge multiple sources
│       ├── joyconReport.ts           # pure JoyCon HID report decoders
│       └── webhid.d.ts               # minimal WebHID type declarations
```

- [ ] **Step 10: Update README.md — input-flow diagram and Tech line**

Replace:

````markdown
```
Left JoyCon ──▶ QJoyControl (unmodified) ──▶ OS key events ──▶ Browser
                                                                │
   stick up/down → ↑/↓ keys ─(keydown/keyup)→ stick.y ∈ {-1,0,1} │
   buttons       → letter keys ─────────────→ ButtonState        ─┴─▶ ScrollEngine + DocumentView
```
````

with:

````markdown
```
Left JoyCon ──(Bluetooth HID)──▶ WebHID ──▶ 0x30 report
                                              │
   stick vertical → threshold → stick.y ∈ {-1,0,1} │
   button byte    → ButtonState                    ─┴─▶ CompositeInputSource ──▶ ScrollEngine + DocumentView
   keyboard (fallback) ────────────────────────────┘
```
````

Then replace:

```markdown
TypeScript · Vite · Vitest · [PDF.js](https://mozilla.github.io/pdf.js/). No UI
```

with:

```markdown
TypeScript · Vite · Vitest · [PDF.js](https://mozilla.github.io/pdf.js/) · [WebHID](https://developer.mozilla.org/en-US/docs/Web/API/WebHID_API). No UI
```

- [ ] **Step 11: Verify and commit**

Run: `npm test`
Expected: full suite PASS.

Run: `grep -rn "QJOYCONTROL-SETUP" README.md src` — Expected: no matches (the old filename link is gone).
Run: `grep -rn "QJoyControl" README.md src` — Expected: no matches (README no longer presents QJoyControl as the input mechanism; `src` never referenced it). Note: `JOYCON-SETUP.md` still says "QJoyControl" a couple of times on purpose (explaining it is no longer needed and can conflict) — that is expected, so it is not part of this grep.

```bash
git add -A
git commit -m "docs: replace QJoyControl setup with WebHID JoyCon guide"
```

---

## Task 6: On-device verification (manual — human in the loop)

**This task cannot be done by a subagent.** It needs the physical JoyCon and a Chromium browser. The controller should pause here and run it with the user.

- [ ] **Step 1: Launch and connect**

Run `npm run dev`, open the printed URL in Chrome/Edge, load a PDF, click **Connect Joy-Con**, and pick the Left JoyCon. Confirm the HUD flips to **"Joy-Con ●"**.

- [ ] **Step 2: Verify buttons**

Confirm each mapped button works: D-pad up/down changes **Max** in the HUD, SL/SR changes **Text**, D-pad left/right seeks, ZL toggles cruise (state shows **Cruise**/**Paused**).

- [ ] **Step 3: Verify + calibrate the stick throttle**

Push the stick **up** — the page should scroll **forward**. If it scrolls backward, set `invertThrottle: true` in `src/config.ts`. If the throttle triggers on a light touch or needs too firm a push, adjust `stickThreshold` (raise to require a bigger push, lower for a lighter one). Reload and re-test until up = forward and the deadzone feels right.

- [ ] **Step 4: Commit any calibration change**

If `src/config.ts` changed:

```bash
git add src/config.ts
git commit -m "chore: calibrate JoyCon throttle direction/threshold"
```

If no change was needed, note that and skip the commit.

---

## Notes

- **`ControlMapper`, `ScrollEngine`, `types.ts` are untouched.** The JoyCon source produces the same `InputFrame` and quantized `stick.y ∈ {-1,0,1}`, so the binary throttle behaves exactly as before — only the input origin changed.
- **`isConnected()` returns to the JoyCon source only**, not the `InputSource` interface (which stays `getFrame/start/stop`). `main.ts` queries `joycon.isConnected()` directly for the HUD and Connect-button visibility.
- **WebHID unsupported** (Firefox/Safari): `navigator.hid` is undefined, the source is inert, the Connect button stays hidden, the HUD shows "Joy-Con ○", and the keyboard fallback drives the app.
- **`sendReport` payload length:** if a specific JoyCon rejects the short 11-byte subcommand payload, pad `fullReportModeReport` to the full output-report length — but only if hands-on testing shows the stick never activates (surface this during Task 6, don't pre-pad).
