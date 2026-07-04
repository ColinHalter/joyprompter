# Throttle-Direction Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a clickable HUD item that flips the JoyCon stick's throttle direction live (session-only, starting from `CONFIG.invertThrottle`).

**Architecture:** `main.ts` owns a mutable `invertThrottle` and injects a `getInvert` getter into `JoyConHidInputSource` (which reads it at HID-report time in `decodeThrottle`). The HUD renders a `data-action="flip-throttle"` item; a delegated click listener on the HUD container flips the state. A `mousemove` listener reveals the auto-hiding HUD so the item stays clickable. `decodeThrottle`, `ControlMapper`, `ScrollEngine`, and `types.ts` are unchanged.

**Tech Stack:** TypeScript · Vite · Vitest (jsdom, globals)

**Design doc:** [docs/superpowers/specs/2026-07-03-throttle-direction-toggle-design.md](../specs/2026-07-03-throttle-direction-toggle-design.md)

---

## File overview

- `src/hud/Hud.ts` (modify) — `HudModel` gains `inverted: boolean`; `update()` renders the clickable direction item.
- `src/hud/Hud.test.ts` (modify) — add tests for the direction item's label + `data-action`.
- `src/styles.css` (modify) — add `.hud-toggle` (pointer cursor + underline).
- `src/input/JoyConHidInputSource.ts` (modify) — constructor takes `{ getInvert: () => boolean }`, used in `decodeThrottle`.
- `src/main.ts` (modify) — own `invertThrottle`, inject the getter, delegated flip click, `mousemove` reveal, pass `inverted` to the HUD.
- `JOYCON-SETUP.md` + `README.md` (modify) — note the in-app toggle.

Note: these changes are mutually dependent for compilation (a required `inverted` field on `HudModel` and the new constructor arg both ripple into `main.ts`), so Task 1 changes the four source files together, driven by the Hud rendering test.

---

## Task 1: In-HUD throttle-direction toggle (TDD on the HUD rendering, then wire it up)

**Files:**
- Modify: `src/hud/Hud.ts`
- Test: `src/hud/Hud.test.ts`
- Modify: `src/styles.css`
- Modify: `src/input/JoyConHidInputSource.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write the failing test**

Replace the entire contents of `src/hud/Hud.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { stateLabel, Hud, type HudModel } from './Hud';

const base: HudModel = {
  connected: true,
  state: 'MANUAL',
  maxSpeed: 300,
  fontSize: 48,
  progress: 0,
  inverted: false,
};

describe('stateLabel', () => {
  it('maps scroll states to human labels', () => {
    expect(stateLabel('HOLD')).toBe('Paused');
    expect(stateLabel('MANUAL')).toBe('Manual');
    expect(stateLabel('CRUISE')).toBe('Cruise');
  });
});

describe('Hud throttle-direction item', () => {
  it('renders "up = forward" with a flip action when not inverted', () => {
    const el = document.createElement('div');
    new Hud(el).update({ ...base, inverted: false });
    const toggle = el.querySelector('[data-action="flip-throttle"]');
    expect(toggle).not.toBeNull();
    expect(toggle?.textContent).toContain('↑ = forward');
  });
  it('renders "up = reverse" when inverted', () => {
    const el = document.createElement('div');
    new Hud(el).update({ ...base, inverted: true });
    expect(el.querySelector('[data-action="flip-throttle"]')?.textContent).toContain('↑ = reverse');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hud/Hud.test.ts`
Expected: FAIL — `HudModel` has no `inverted` property (type error) and/or no element matches `[data-action="flip-throttle"]`.

- [ ] **Step 3: Add `inverted` to the model and render the item**

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
  inverted: boolean;
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
      <span class="hud-item hud-toggle" data-action="flip-throttle">${m.inverted ? '↑ = reverse' : '↑ = forward'}</span>
    `;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/hud/Hud.test.ts`
Expected: PASS (stateLabel + both direction-item tests).

- [ ] **Step 5: Style the toggle item**

In `src/styles.css`, replace:

```css
.hud-item.bad { color: #e08080; }
```

with:

```css
.hud-item.bad { color: #e08080; }
.hud-toggle { cursor: pointer; text-decoration: underline; }
```

- [ ] **Step 6: Inject the invert getter into the JoyCon source**

In `src/input/JoyConHidInputSource.ts`, add a constructor and use the getter. Replace:

```ts
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
```

with:

```ts
export class JoyConHidInputSource implements InputSource {
  private frame: InputFrame = structuredClone(NEUTRAL_FRAME);
  private device: HIDDevice | null = null;
  private packet = 0;

  constructor(private opts: { getInvert: () => boolean }) {}

  private onInputReport = (e: HIDInputReportEvent): void => {
    if (e.reportId !== FULL_REPORT_ID) return;
    this.frame.buttons = decodeButtons(e.data);
    this.frame.stick.y = decodeThrottle(e.data, {
      threshold: CONFIG.stickThreshold,
      invert: this.opts.getInvert(),
    });
  };
```

(The arrow-function field `onInputReport` only reads `this.opts` when a report arrives — long after construction — so the field/constructor ordering is safe.)

- [ ] **Step 7: Wire the invert state, flip click, and HUD field in main.ts**

In `src/main.ts`, replace:

```ts
const joycon = new JoyConHidInputSource();
const source = new CompositeInputSource([joycon, new KeyInputSource()]);
source.start();

connectBtn.addEventListener('click', () => { void joycon.connect(); });
```

with:

```ts
let invertThrottle = CONFIG.invertThrottle;
const joycon = new JoyConHidInputSource({ getInvert: () => invertThrottle });
const source = new CompositeInputSource([joycon, new KeyInputSource()]);
source.start();

connectBtn.addEventListener('click', () => { void joycon.connect(); });

// Flip the throttle direction from the HUD. Delegated because the HUD's innerHTML
// is rebuilt every frame, which would wipe a per-element listener.
hudEl.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('[data-action="flip-throttle"]')) {
    invertThrottle = !invertThrottle;
    markActivity(performance.now());
  }
});

// Reveal the auto-hiding HUD on mouse movement so its controls stay clickable.
window.addEventListener('mousemove', () => markActivity(performance.now()));
```

(`markActivity` is a hoisted function declaration later in the file, and `lastActivity` is initialized before any event fires, so calling it from these listeners is safe.)

Then, in the same file, replace the `hud.update({ ... })` call:

```ts
  hud.update({
    connected,
    state: engine.state,
    maxSpeed: engine.maxSpeed,
    fontSize,
    progress: maxScroll > 0 ? pos / maxScroll : 0,
  });
```

with:

```ts
  hud.update({
    connected,
    state: engine.state,
    maxSpeed: engine.maxSpeed,
    fontSize,
    progress: maxScroll > 0 ? pos / maxScroll : 0,
    inverted: invertThrottle,
  });
```

- [ ] **Step 8: Type-check, test, build**

Run: `npx tsc --noEmit -p tsconfig.build.json`
Expected: exit 0.

Run: `npm test`
Expected: full suite PASS (Hud tests now include the two direction-item cases).

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 9: Commit**

```bash
git add src/hud/Hud.ts src/hud/Hud.test.ts src/styles.css src/input/JoyConHidInputSource.ts src/main.ts
git commit -m "feat: in-HUD toggle to flip JoyCon throttle direction"
```

---

## Task 2: Document the in-app toggle

**Files:**
- Modify: `JOYCON-SETUP.md`
- Modify: `README.md`

Docs-only.

- [ ] **Step 1: Update the JOYCON-SETUP.md Tuning section**

In `JOYCON-SETUP.md`, replace:

```markdown
## Tuning
The stick is a binary throttle. If pushing up scrolls the wrong way, set
`CONFIG.invertThrottle = true` in `src/config.ts`. If it triggers too easily or needs too
big a push, adjust `CONFIG.stickThreshold` (raw stick units from center; larger = firmer
push required).
```

with:

```markdown
## Tuning
The stick is a binary throttle. If pushing up scrolls the wrong way, click the direction
item in the HUD (`↑ = forward` / `↑ = reverse`) to flip it live — this resets each reload.
To change the starting default, set `CONFIG.invertThrottle` in `src/config.ts`. If the
throttle triggers too easily or needs too big a push, adjust `CONFIG.stickThreshold` (raw
stick units from center; larger = firmer push required).
```

- [ ] **Step 2: Update the README.md configuration row**

In `README.md`, replace:

```markdown
| `invertThrottle` | Flip if pushing the stick up scrolls the wrong way. |
```

with:

```markdown
| `invertThrottle` | Starting throttle direction; flip it live in-app via the HUD `↑ = forward` / `↑ = reverse` item (resets each reload). |
```

- [ ] **Step 3: Verify and commit**

Run: `npm test`
Expected: full suite PASS (docs-only change; nothing breaks).

```bash
git add JOYCON-SETUP.md README.md
git commit -m "docs: note the in-app throttle-direction toggle"
```

---

## Notes

- **`decodeThrottle`, `ControlMapper`, `ScrollEngine`, `types.ts` are untouched.** Only where the JoyCon shell sources the `invert` value changes (from `CONFIG` to an injected getter).
- **Session-only by decision** — no localStorage. `invertThrottle` initializes from `CONFIG.invertThrottle` each load.
- **The toggle affects the JoyCon stick only** — the keyboard fallback's Arrow ↑/↓ is not inverted by it (it never was routed through `decodeThrottle`).
- **`.DS_Store`** may be present untracked in the working tree; never stage it — use the explicit `git add` lists above.
