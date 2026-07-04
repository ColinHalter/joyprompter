# Light/Dark Theme Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A clickable HUD item toggles the whole UI between the dark theme and a coherent light theme (black text on white). Session-only.

**Architecture:** `main.ts` owns a `lightMode` boolean; a delegated HUD click flips it and toggles a `light` class on `<body>`; CSS `body.light` overrides (layered over the untouched dark rules) restyle the page, HUD, and drop-zone. The HUD renders a `data-action="toggle-theme"` item, reusing the memoized-render + mousemove-reveal infrastructure the throttle-direction toggle already established.

**Tech Stack:** TypeScript · Vite · Vitest (jsdom, globals)

**Design doc:** [docs/superpowers/specs/2026-07-03-light-theme-toggle-design.md](../specs/2026-07-03-light-theme-toggle-design.md)

---

## File overview

- `src/hud/Hud.ts` + `.test.ts` — `HudModel.light`; render the `toggle-theme` item.
- `src/styles.css` — `body.light` override block.
- `src/main.ts` — `lightMode` state; extend the HUD click handler; pass `light` to the HUD.
- `README.md` — one Features bullet.

These are mutually dependent for compilation (a required `light` field on `HudModel` ripples into `main.ts`'s `hud.update` call), so Task 1 changes the four source files together, driven by the Hud rendering test.

---

## Task 1: Light/dark theme toggle (TDD on the HUD rendering, then wire it up)

**Files:**
- Modify: `src/hud/Hud.ts`
- Test: `src/hud/Hud.test.ts`
- Modify: `src/styles.css`
- Modify: `src/main.ts`

- [ ] **Step 1: Write the failing test**

In `src/hud/Hud.test.ts`, add `light: false` to the shared `base` model — replace:

```ts
const base: HudModel = {
  connected: true,
  state: 'MANUAL',
  maxSpeed: 300,
  fontSize: 48,
  progress: 0,
  inverted: false,
};
```

with:

```ts
const base: HudModel = {
  connected: true,
  state: 'MANUAL',
  maxSpeed: 300,
  fontSize: 48,
  progress: 0,
  inverted: false,
  light: false,
};
```

Then add this describe block immediately after the existing `describe('Hud throttle-direction item', ...)` block (i.e. before `describe('Hud rendering stability', ...)`):

```ts
describe('Hud theme item', () => {
  it('shows "Theme: dark" and a toggle action when not in light mode', () => {
    const el = document.createElement('div');
    new Hud(el).update({ ...base, light: false });
    const toggle = el.querySelector('[data-action="toggle-theme"]');
    expect(toggle).not.toBeNull();
    expect(toggle?.textContent).toContain('Theme: dark');
  });
  it('shows "Theme: light" when in light mode', () => {
    const el = document.createElement('div');
    new Hud(el).update({ ...base, light: true });
    expect(el.querySelector('[data-action="toggle-theme"]')?.textContent).toContain('Theme: light');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hud/Hud.test.ts`
Expected: FAIL — no element matches `[data-action="toggle-theme"]` (and `HudModel` has no `light` field yet at runtime the item is absent).

- [ ] **Step 3: Add `light` to the model and render the theme item**

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
  light: boolean;
}

export class Hud {
  private lastHtml = '';
  constructor(private el: HTMLElement) {}

  update(m: HudModel): void {
    const pct = Math.round(m.progress * 100);
    const html = `
      <span class="hud-item ${m.connected ? 'ok' : 'bad'}">${m.connected ? 'Joy-Con ●' : 'Joy-Con ○'}</span>
      <span class="hud-item">${stateLabel(m.state)}</span>
      <span class="hud-item">Max ${Math.round(m.maxSpeed)} px/s</span>
      <span class="hud-item">Text ${Math.round(m.fontSize)} px</span>
      <span class="hud-item">${pct}%</span>
      <span class="hud-item hud-toggle" data-action="flip-throttle">${m.inverted ? '↑ = reverse' : '↑ = forward'}</span>
      <span class="hud-item hud-toggle" data-action="toggle-theme">${m.light ? 'Theme: light' : 'Theme: dark'}</span>
    `;
    // Only touch the DOM when the rendered content changes. Rebuilding innerHTML every
    // frame would destroy and recreate the clickable toggle span mid-click, so the click
    // gesture's mousedown/mouseup would land on different nodes and never activate it.
    if (html === this.lastHtml) return;
    this.lastHtml = html;
    this.el.innerHTML = html;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/hud/Hud.test.ts`
Expected: PASS (stateLabel + throttle-item + the two new theme-item tests + stability tests).

- [ ] **Step 5: Add the light-theme CSS**

In `src/styles.css`, replace:

```css
body.mirrored { transform: scaleX(-1); }
```

with:

```css
body.mirrored { transform: scaleX(-1); }

body.light { background: #fff; color: #111; color-scheme: light; }
body.light #hud { background: rgba(255,255,255,0.75); }
body.light .hud-item { color: #334; }
body.light .hud-item.ok { color: #1f8f3a; }
body.light .hud-item.bad { color: #c02b2b; }
body.light #drop-zone { background: rgba(255,255,255,0.9); color: #444; }
body.light #drop-zone.dragover { background: rgba(200,230,200,0.95); color: #000; }
```

- [ ] **Step 6: Wire the theme state, click, and HUD field in main.ts**

In `src/main.ts`, replace:

```ts
let invertThrottle = CONFIG.invertThrottle;
const joycon = new JoyConHidInputSource({ getInvert: () => invertThrottle });
```

with:

```ts
let invertThrottle = CONFIG.invertThrottle;
let lightMode = false;
const joycon = new JoyConHidInputSource({ getInvert: () => invertThrottle });
```

Then replace:

```ts
hudEl.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('[data-action="flip-throttle"]')) {
    invertThrottle = !invertThrottle;
    markActivity(performance.now());
  }
});
```

with:

```ts
hudEl.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (target.closest('[data-action="flip-throttle"]')) {
    invertThrottle = !invertThrottle;
    markActivity(performance.now());
  } else if (target.closest('[data-action="toggle-theme"]')) {
    lightMode = !lightMode;
    document.body.classList.toggle('light', lightMode);
    markActivity(performance.now());
  }
});
```

Then replace the `hud.update({ ... })` call:

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

with:

```ts
  hud.update({
    connected,
    state: engine.state,
    maxSpeed: engine.maxSpeed,
    fontSize,
    progress: maxScroll > 0 ? pos / maxScroll : 0,
    inverted: invertThrottle,
    light: lightMode,
  });
```

- [ ] **Step 7: Type-check, test, build**

Run: `npx tsc --noEmit -p tsconfig.build.json`
Expected: exit 0.

Run: `npm test`
Expected: full suite PASS.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/hud/Hud.ts src/hud/Hud.test.ts src/styles.css src/main.ts
git commit -m "feat: in-HUD light/dark theme toggle"
```

---

## Task 2: Documentation

**Files:**
- Modify: `README.md`

Docs-only.

- [ ] **Step 1: Add a Features bullet**

In `README.md`, replace:

```markdown
- On-screen HUD: scroll state, max speed, text size, progress
```

with:

```markdown
- On-screen HUD: scroll state, max speed, text size, progress
- Light/dark theme toggle — click the **Theme** item in the HUD
```

- [ ] **Step 2: Verify and commit**

Run: `npm test`
Expected: full suite PASS (docs-only; nothing breaks).

```bash
git add README.md
git commit -m "docs: note the in-HUD light/dark theme toggle"
```

---

## Notes

- **Session-only** — `lightMode` starts `false` each load; no persistence (by design).
- **The `body.light` overrides layer over the untouched dark rules**, so the default dark theme cannot regress. Higher selector specificity (`body.light #hud` beats `#hud`, `body.light .hud-item.ok` beats `.hud-item.ok`, `body.light` beats `html, body`) makes them win without `!important`.
- **UI-only** — no JoyCon/keyboard binding, no `Command`/`ControlMapper` change. Independent of the mirror toggle (separate `<body>` class); both compose.
- **`.DS_Store`** may be present untracked; never stage it — use the explicit `git add` lists above.
