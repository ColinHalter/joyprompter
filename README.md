# JoyCon Teleprompter

A browser-based teleprompter you drive with a Nintendo Switch **Left JoyCon**. Load a
PDF, and its text is reflowed into large, centered, vertically-scrolling copy. The
analog stick acts as a binary **throttle** (push up to scroll forward, down to reverse,
both at the max speed); ZL toggles hands-free **cruise**; the D-pad and shoulder buttons
handle max speed, paragraph seeking, and text size.

Input comes from an **unmodified** [QJoyControl](https://github.com/erikmwerner/QJoyControl):
it maps every JoyCon input to a keyboard key — the stick's up/down to the arrow keys and
the buttons to letter keys. **No custom QJoyControl build is required.**

The PDF is parsed entirely in your browser — nothing is uploaded, and it works offline.

## Features

- PDF text extraction and reflow into a clean teleprompter column
- Binary throttle scrolling — forward/reverse at the max speed
- Hands-free cruise mode at an adjustable max speed
- Text-size and per-paragraph seek controls
- On-screen HUD: scroll state, max speed, text size, progress
- Runs entirely from the keyboard, so it works with or without a JoyCon

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ and npm
- A modern browser (ES modules)
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
2. **Drive it** — use the JoyCon (or the keyboard keys below). There is no engage step;
   the app responds to input immediately.

> For JoyCon use, configure QJoyControl per [QJOYCONTROL-SETUP.md](./QJOYCONTROL-SETUP.md).

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

## Controls (Left JoyCon)

| Input        | Action                                         |
|--------------|------------------------------------------------|
| Stick ▲ / ▼  | Throttle: scroll forward / reverse at max speed |
| ZL           | Toggle cruise (hands-free at max speed)        |
| D-pad ▲ / ▼  | Increase / decrease max scroll speed           |
| D-pad ◀ / ▶  | Seek back / forward one paragraph              |
| SL / SR      | Text size down / up                            |

**Scroll behavior:** centering the stick holds position; pushing up or down scrolls at the
max speed. Pressing ZL starts cruise; pressing again pauses; nudging the stick during
cruise hands control back to manual. See [QJOYCONTROL-SETUP.md](./QJOYCONTROL-SETUP.md) for
the QJoyControl key mapping this expects.

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
| `deadzone` | Ignores tiny throttle jitter near center. |
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
│       └── KeyInputSource.ts         # key events (QJoyControl or keyboard) → InputFrame
├── docs/                       # design specs and implementation plans
└── (package.json, tsconfig.json, vite.config.ts)
```

## How input flows

```
Left JoyCon ──▶ QJoyControl (unmodified) ──▶ OS key events ──▶ Browser
                                                                │
   stick up/down → ↑/↓ keys ─(keydown/keyup)→ stick.y ∈ {-1,0,1} │
   buttons       → letter keys ─────────────→ ButtonState        ─┴─▶ ScrollEngine + DocumentView
```

## Tech

TypeScript · Vite · Vitest · [PDF.js](https://mozilla.github.io/pdf.js/). No UI
framework — the app is a small imperative render loop.
