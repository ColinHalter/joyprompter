# JoyCon Teleprompter

A browser-based teleprompter application for use with a Nintendo Joycon controller. Accepts a PDF or Markdown file and scrolls it downward at a configurable speed.

Prompter scrolling can be controlled either with keyboard commands or directly from the JoyCon (via [WebHID API](https://developer.mozilla.org/en-US/docs/Web/API/WebHID_API))

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ and npm
- A Chromium browser (Chrome/Edge) with WebHID (For Joycon connectivity. Non-chromium is fine for keyboard-only control)
- (Optional) A JoyCon controller paired over Bluetooth (see [JOYCON-SETUP.md](./JOYCON-SETUP.md))

## Install

```bash
npm install
```

## Launch (development)

```bash
npm run dev
```

To access locally, load `http://localhost:5173` then:

1. **Load a document** — drag a PDF or Markdown file onto the window, or click to choose one.
   (Loading Markdown asks you to confirm, since a `.md` can contain embedded code.)
2. **Connect the JoyCon** — click **Connect Joy-Con** (top-right) once and select the JoyCon. 
3. The HUD shows **"Joy-Con ●"** when connected. Or skip it and use the keyboard keys below.

> For pairing and browser details, see [JOYCON-SETUP.md](./JOYCON-SETUP.md).

### Keyboard keys


| Key         | Action                                 |
|-------------|----------------------------------------|
| ↑ / ↓       | Throttle forward / reverse (max speed) |
| `z`         | Toggle cruise                          |
| `i` / `k`   | Increase / decrease max speed          |
| `j` / `l`   | Seek back / forward a paragraph        |
| `q` / `e`   | Text size down / up                    |
| `m`         | Mirror the screen                      |

## Controls (JoyCon)

| Input        | Action                                         |
|--------------|------------------------------------------------|
| Stick ▲ / ▼  | Throttle: scroll forward / reverse at max speed |
| ZL           | Toggle cruise (hands-free at max speed)        |
| Capture      | Mirror the screen left-to-right (beam-splitter) |
| D-pad ▲ / ▼  | Increase / decrease max scroll speed           |
| D-pad ◀ / ▶  | Seek back / forward one paragraph              |
| SL / SR      | Text size down / up                            |

**Scroll behavior:** centering the stick holds position; pushing up or down scrolls at the max speed. Pressing ZL starts cruise; pressing again pauses; nudging the stick during cruise hands control back to manual. See [JOYCON-SETUP.md](./JOYCON-SETUP.md) for pairing and connection details.

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
| `invertThrottle` | Starting throttle direction; flip it live in-app via the HUD `↑ = forward` / `↑ = reverse` item (resets each reload). |
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
│   ├── document/DocumentView.ts      # dispatch by file type + render + font size
│   ├── document/pdf.ts               # PDF.js text extraction → paragraphs
│   ├── document/markdown.ts          # Markdown → HTML (marked)
│   ├── document/fileType.ts          # classify pdf vs markdown
│   ├── document/paragraphs.ts        # reflow + seek helpers
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

TypeScript · Vite · Vitest · [PDF.js](https://mozilla.github.io/pdf.js/) · [marked](https://marked.js.org/) · [WebHID](https://developer.mozilla.org/en-US/docs/Web/API/WebHID_API). No UI
framework — the app is a small imperative render loop.

## AI Disclosure

Most of this was (very obviously) generated using Claude Code. I am not much of a Node guy and I mainly made this for personal use.