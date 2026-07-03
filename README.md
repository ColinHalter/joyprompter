# JoyCon Teleprompter

A browser-based teleprompter you drive with a Nintendo Switch **Left JoyCon**. Load a
PDF, and its text is reflowed into large, centered, vertically-scrolling copy. The
analog stick acts as a proportional **throttle** (push up to scroll forward, down to
reverse, further = faster); a stick-click toggles hands-free **cruise**; the D-pad and
shoulder buttons handle text size, paragraph seeking, and max speed.

Input comes from an **unmodified** [QJoyControl](https://github.com/erikmwerner/QJoyControl):
the app uses QJoyControl's built-in *analog-stick → mouse* feature (captured in the
browser via the Pointer Lock API and interpreted as a throttle) and its
*button → keyboard key* mapping. **No custom QJoyControl build is required.**

The PDF is parsed entirely in your browser — nothing is uploaded, and it works offline.

## Features

- PDF text extraction and reflow into a clean teleprompter column
- Proportional throttle scrolling (forward/reverse) with a center deadzone
- Hands-free cruise mode at an adjustable max speed
- Text-size and per-paragraph seek controls
- On-screen HUD: controller status, scroll state, max speed, text size, progress
- Hardware-free keyboard mode for development and testing

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ and npm
- A modern browser (Pointer Lock + ES modules)
- For controller use: a Left JoyCon and QJoyControl (see [QJOYCONTROL-SETUP.md](./QJOYCONTROL-SETUP.md))

## Install

```bash
npm install
```

## Launch (development)

```bash
npm run dev
```

Vite prints a local URL (default `http://localhost:5173`). Open it, then:

1. **Load a PDF** — drag a PDF onto the window, or click to choose one.
2. **Engage the controller** — click the text area once to enable Pointer Lock
   (this lets the browser read the stick-as-mouse without the cursor hitting screen
   edges). Press **Esc** to release; click again to re-engage. The HUD reads
   **"Controller ●"** when engaged.

> Requires QJoyControl configured per [QJOYCONTROL-SETUP.md](./QJOYCONTROL-SETUP.md).

### Try it without a JoyCon (keyboard mode)

Open the app with `?input=keyboard`:

```
http://localhost:5173/?input=keyboard
```

| Key         | Action                         |
|-------------|--------------------------------|
| ↑ / ↓       | Throttle forward / reverse     |
| `c`         | Toggle cruise                  |
| `i` / `k`   | Text size up / down            |
| `j` / `l`   | Seek back / forward a paragraph|
| `q` / `e`   | Decrease / increase max speed  |

## Controls (Left JoyCon)

| Input        | Action                                         |
|--------------|------------------------------------------------|
| Stick ▲ / ▼  | Throttle: scroll forward / reverse (proportional) |
| Stick click  | Toggle cruise (hands-free at max speed)        |
| D-pad ▲ / ▼  | Text size up / down                            |
| D-pad ◀ / ▶  | Seek back / forward one paragraph              |
| SL / SR      | Decrease / increase max scroll speed           |

**Scroll behavior:** centering the stick holds position. Clicking the stick starts
cruise; clicking again pauses; nudging the stick during cruise hands control back to
manual. See [QJOYCONTROL-SETUP.md](./QJOYCONTROL-SETUP.md) for the QJoyControl
button-to-key mapping this expects.

## Build (production)

```bash
npm run build      # type-checks, then bundles to dist/
npm run preview    # serve the built dist/ locally
```

The `dist/` folder is static — it can be opened from any static host or locally.

## Test

```bash
npm test           # run the unit suite once (Vitest)
npm run test:watch # watch mode
```

## Configuration & tuning

All tunables live in [`src/config.ts`](./src/config.ts):

| Setting | Purpose |
|---------|---------|
| `mouseFullThrottleRate` | Mouse-movement rate (px/s) that maps to full throttle. Tune together with QJoyControl's analog sensitivity. |
| `invertThrottle` | Set `true` if up/down feel reversed. |
| `deadzone` | Ignores small stick/mouse jitter near center. |
| `minMaxSpeed` / `maxMaxSpeed` / `maxSpeedStep` / `initialMaxSpeed` | Scroll speed range and SL/SR step. |
| `minFontSize` / `maxFontSize` / `fontSizeStep` / `initialFontSize` | Text size range and D-pad step. |
| `hudHideMs` | How long before the HUD fades after inactivity. |
| `keyMap` | Keys the app listens for → controller actions. Change here **and** in QJoyControl if you want different keys. |

## Project structure

```
.
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
│       ├── mouseRateToStick.ts       # mouse-rate → normalized throttle
│       ├── QJoyControlInputSource.ts # Pointer Lock + mapped keys (default)
│       └── KeyboardInputSource.ts    # keyboard dev/test source
├── docs/                       # design specs and implementation plans
└── (package.json, tsconfig.json, vite.config.ts)
```

## How input flows

```
Left JoyCon ──▶ QJoyControl (unmodified) ──▶ OS mouse + key events ──▶ Browser
                                                                        │
   stick → mouse ─(Pointer Lock movementY)→ mouseRateToStick → stick.y  │
   buttons → keys ─(keydown/keyup)────────→ ButtonState               ──┴─▶ ScrollEngine + DocumentView
```

## Tech

TypeScript · Vite · Vitest · [PDF.js](https://mozilla.github.io/pdf.js/). No UI
framework — the app is a small imperative render loop.
