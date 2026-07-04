# JoyCon Teleprompter

A browser-based teleprompter you drive with a Nintendo Switch **Left JoyCon**. Load a
PDF, and its text is reflowed into large, centered, vertically-scrolling copy. The
analog stick acts as a binary **throttle** (push up to scroll forward, down to reverse,
both at the max speed); ZL toggles hands-free **cruise**; the D-pad and shoulder buttons
handle max speed, paragraph seeking, and text size.

Input comes **directly from the JoyCon** over the browser's [WebHID API](https://developer.mozilla.org/en-US/docs/Web/API/WebHID_API) —
no driver or helper app. Click **Connect Joy-Con** once and the app reads the stick and
buttons straight from the controller. A keyboard fallback works in any browser.

The PDF is parsed entirely in your browser — nothing is uploaded, and it works offline.

## Features

- PDF text extraction and reflow into a clean teleprompter column
- Binary throttle scrolling — forward/reverse at the max speed
- Hands-free cruise mode at an adjustable max speed
- Text-size and per-paragraph seek controls
- On-screen HUD: scroll state, max speed, text size, progress
- Reads the JoyCon directly over WebHID (Chromium), with a keyboard fallback everywhere

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ and npm
- A modern browser (ES modules). For JoyCon use: a Chromium browser (Chrome/Edge) with WebHID
- A Left JoyCon paired over Bluetooth (see [JOYCON-SETUP.md](./JOYCON-SETUP.md))

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
2. **Connect the JoyCon** — click **Connect Joy-Con** (top-right) once and pick the Left
   JoyCon. After the first grant the browser reconnects automatically on reload; the HUD
   shows **"Joy-Con ●"** when connected. Or skip it and use the keyboard keys below.

> For pairing and browser details, see [JOYCON-SETUP.md](./JOYCON-SETUP.md).

### Keyboard keys

The keyboard is always active as a fallback, so you can use the app without a JoyCon:

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
cruise hands control back to manual. See [JOYCON-SETUP.md](./JOYCON-SETUP.md) for pairing
and connection details.

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
| `stickThreshold` | How far the JoyCon stick must move from center (raw units) to trigger the binary throttle. |
| `invertThrottle` | Flip if pushing the stick up scrolls the wrong way. |
| `minMaxSpeed` / `maxMaxSpeed` / `maxSpeedStep` / `initialMaxSpeed` | Scroll speed range and D-pad step. |
| `minFontSize` / `maxFontSize` / `fontSizeStep` / `initialFontSize` | Text size range and SL/SR step. |
| `hudHideMs` | How long before the HUD fades after inactivity. |
| `keyMap` | Keyboard-fallback keys → controller actions. |

## Project structure

```
.
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
├── docs/                       # design specs and implementation plans
└── (package.json, tsconfig.json, vite.config.ts)
```

## How input flows

```
Left JoyCon ──(Bluetooth HID)──▶ WebHID ──▶ 0x30 report
                                              │
   stick vertical → threshold → stick.y ∈ {-1,0,1} │
   button byte    → ButtonState                    ─┴─▶ CompositeInputSource ──▶ ScrollEngine + DocumentView
   keyboard (fallback) ────────────────────────────┘
```

## Tech

TypeScript · Vite · Vitest · [PDF.js](https://mozilla.github.io/pdf.js/) · [WebHID](https://developer.mozilla.org/en-US/docs/Web/API/WebHID_API). No UI
framework — the app is a small imperative render loop.
