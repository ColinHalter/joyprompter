# Light/Dark Theme Toggle (HUD)

## Problem

The teleprompter is dark (white text on black). The user wants a UI element to invert it to
a full light theme — black text on a white background — e.g. for a mirrored teleprompter
with a camera where black-on-white reads better.

## Goal

A clickable HUD item toggles the whole UI between the existing dark theme and a coherent
light theme (black text on white, light HUD). Session-only — resets to dark on reload.

## Design

### Trigger & state

A new clickable HUD item with `data-action="toggle-theme"`, labeled `Theme: dark` /
`Theme: light` (shows the current theme; click to switch). `main.ts` owns a session
`let lightMode = false`. A delegated click on the HUD container flips it and toggles a
`light` class on `<body>`. This reuses the infrastructure the throttle-direction toggle
established: the HUD's memoized render keeps the item's DOM node stable (so the click
lands), and the existing `mousemove` → `markActivity` reveals the auto-hiding HUD.

UI-only: no JoyCon button, keyMap, `Command`, or `ControlMapper` changes. Independent of the
mirror toggle — both are separate `<body>` classes and compose without interaction.

### Light theme via CSS overrides

A `body.light` block plus targeted overrides, layered on top of the existing dark rules
(which stay untouched, so the default dark theme cannot regress):

- `body.light` → `background: #fff; color: #111; color-scheme: light;` — flips the reading
  surface (the serif script becomes black-on-white; `#scroller` is transparent and `#doc`
  inherits `color`, so this alone re-colors the script).
- `body.light #hud` → light translucent bar; `body.light .hud-item` / `.ok` / `.bad` →
  dark-on-light colors with good contrast.
- `body.light #drop-zone` and `body.light #drop-zone.dragover` → light overlay.
- `#connect-joycon` (blue) is intentionally left unthemed — it reads fine on white.

Selector specificity makes the overrides win without `!important`: `body.light #hud`
(id + class + element) beats the bare `#hud` (id only); `body.light .hud-item.ok`
(three classes + element) beats `.hud-item.ok` (two classes); `body.light` beats
`html, body`.

### Files

- **src/hud/Hud.ts** — `HudModel` gains `light: boolean`; `update()` renders, after the
  throttle-direction item, `<span class="hud-item hud-toggle" data-action="toggle-theme">${m.light ? 'Theme: light' : 'Theme: dark'}</span>`.
- **src/hud/Hud.test.ts** — add `light: false` to the shared test model; add a test asserting
  the theme item shows `Theme: dark` when `light` is false and `Theme: light` when true, with
  the `data-action="toggle-theme"` attribute present.
- **src/main.ts** — `let lightMode = false;`; extend the existing delegated HUD click handler
  with an `else if (target.closest('[data-action="toggle-theme"]'))` branch that flips
  `lightMode`, toggles `document.body.classList.toggle('light', lightMode)`, and calls
  `markActivity(...)`; pass `light: lightMode` into `hud.update(...)`.
- **src/styles.css** — the `body.light` override block.
- **README.md** — one Features bullet noting the in-HUD light/dark theme toggle.

### Testing

- `Hud` unit test for the theme item (label + `data-action` for both states). The existing
  HUD node-stability and throttle-item tests continue to pass.
- The `main.ts` click wiring and the CSS are thin/visual; verified hands-on (the light theme
  renders correctly, click toggles it, dark remains the default). No new controller path to
  test.

## Out of scope

- Persistence across reloads (session-only by decision).
- A JoyCon/keyboard binding for the theme (UI element only).
- Theming the Connect button (left blue).
- Per-element color customization beyond the two themes.
