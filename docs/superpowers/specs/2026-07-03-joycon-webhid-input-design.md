# JoyCon Input via WebHID

## Problem

The teleprompter's throttle needs the Left JoyCon's analog stick, but neither available
path delivers it:

- **QJoyControl** maps buttons to keys reliably, but cannot bind the analog stick's
  directions to keys, and it claims the device exclusively (so nothing else can read the
  stick while it runs).
- **The Web Gamepad API** sees the JoyCon's buttons but not the stick: a bare JoyCon over
  Bluetooth boots in a simplified HID mode that never reports the analog stick as an axis.
  Unlocking the stick requires the JoyCon's proprietary "full report mode" handshake, which
  the Gamepad API does not perform.

The only way to read the stick in the browser is to talk to the JoyCon directly over
**WebHID**, sending the handshake ourselves. WebHID also exposes every button, so it fully
replaces QJoyControl.

## Goal

Read the Left JoyCon directly over WebHID and drive the existing binary-throttle control
scheme, with QJoyControl removed entirely. Keyboard input remains as a fallback for
development and non-Chromium browsers.

## Design

### Architecture

A new `JoyConHidInputSource` connects to the Left JoyCon over WebHID and produces the same
`InputFrame` the app already consumes. The JoyCon's `0x30` input report carries all seven
buttons the app uses (up, down, left, right, SL, SR, ZL) plus the analog stick, so
**`ControlMapper`, `ScrollEngine`, and `types.ts` do not change** — this is a new input
source plus wiring only.

`KeyInputSource` (keyboard) stays alive as a parallel fallback. A small
`CompositeInputSource` merges the two so both work at once. This restores the intended
control scheme:

- **Stick ↑/↓** — binary throttle (forward/reverse at max speed)
- D-pad ↑/↓ — increase/decrease max speed
- SL / SR — text size down/up
- D-pad ◀/▶ — seek back/forward one paragraph
- ZL — toggle cruise

### Components / files

**New `src/input/joyconReport.ts`** — pure decoders and protocol constants; no I/O, fully
unit-testable.
- Constants: `NINTENDO_VENDOR_ID = 0x057E`, `JOYCON_L_PRODUCT_ID = 0x2006`,
  `STICK_CENTER = 2048`, and the full-report-mode output payload builder.
- `decodeButtons(data: DataView): ButtonState` — reads the Left-button byte.
- `decodeThrottle(data: DataView, opts: { threshold: number; invert: boolean }): -1 | 0 | 1`
  — reads the packed 12-bit vertical stick value, thresholds around center.

WebHID delivers the report data with the reportId stripped, so byte offsets are shifted by
one from the public reverse-engineering docs. In the `inputreport` event's `data` DataView:
- `data[4]` = Left-button byte: bit0 Down, bit1 Up, bit2 Right, bit3 Left, bit4 SR, bit5 SL,
  bit6 L (unused), bit7 ZL.
- Left stick: `h = data[5] | ((data[6] & 0x0F) << 8)`, `v = (data[6] >> 4) | (data[7] << 4)`.
  Upright/portrait hold → the vertical value `v` is the throttle axis. `decodeThrottle`
  returns `+1` when `v` is above `STICK_CENTER + threshold`, `-1` when below
  `STICK_CENTER - threshold`, else `0`; `invert` flips the sign. (Binary means no
  per-device calibration is needed.)

**New `src/input/joyconReport.test.ts`** — unit tests over synthetic report bytes: each
button bit maps to the right `ButtonState` field; stick above/below/within threshold →
`+1`/`-1`/`0`; `invert` flips direction.

**New `src/input/JoyConHidInputSource.ts`** — thin WebHID shell, `implements InputSource`,
plus a concrete `isConnected(): boolean`.
- `start()`: if `navigator.hid` is unavailable, no-op (keyboard still works). Otherwise call
  `navigator.hid.getDevices()`; if a previously-granted Left JoyCon is present, open and
  initialize it (no user click needed). Register a `navigator.hid` `disconnect` listener.
- `connect()`: called from a user gesture (the Connect button). Calls
  `navigator.hid.requestDevice({ filters: [{ vendorId: 0x057E, productId: 0x2006 }] })`,
  then opens and initializes the chosen device.
- Initialize: `device.open()`, subscribe to `inputreport`, then `device.sendReport(0x01, payload)`
  where `payload` sets full report mode — a packet counter (incremented, low nibble) + the
  neutral-rumble preamble `[0x00,0x01,0x40,0x40,0x00,0x01,0x40,0x40]` + subcommand `0x03`
  + argument `0x30`.
- On each `inputreport` with `reportId === 0x30`, decode buttons + throttle into the live
  `InputFrame`; set connected = true.
- On `disconnect` (matching device): reset the frame to `NEUTRAL_FRAME`, set connected =
  false.
- `getFrame()` returns the live frame; `stop()` removes listeners and closes the device.

**New `src/input/CompositeInputSource.ts`** — `implements InputSource`, constructed with an
ordered `InputSource[]`. `start()`/`stop()` fan out to all. `getFrame()` merges: buttons are
OR'd across sources; `stick.y` is the first source (in order) whose `stick.y !== 0`, else 0.
Unit-tested with two fake sources.

**Modify `src/main.ts`** — construct `keyboard = new KeyInputSource()` and
`joycon = new JoyConHidInputSource()`, wrap them in `new CompositeInputSource([joycon, keyboard])`
as the single `source`. Wire the Connect button's click to `joycon.connect()`; hide the
button once `joycon.isConnected()` (and if WebHID is unsupported, hide it and leave keyboard
active). Pass `connected: joycon.isConnected()` into `hud.update`.

**Modify `index.html`** — add a `#connect-joycon` button element (styled minimally in
`styles.css`), shown until a JoyCon is connected.

**Modify `src/hud/Hud.ts`** — re-add a connection indicator span and the `connected: boolean`
field on `HudModel`. It reads "Joy-Con ●" (ok) when connected, "Joy-Con ○" (bad) otherwise.
This reflects real WebHID connection state, so it is meaningful (unlike the removed Pointer
Lock indicator). Restore the `.hud-item.ok` / `.hud-item.bad` CSS rules in `styles.css`.

**Modify `src/config.ts`** — add `stickThreshold: 700` (raw units from center; how far the
stick must move to trigger the binary throttle) and `invertThrottle: false` (flip if up
scrolls the wrong way — confirmed on-device during implementation).

### Data flow

```
Left JoyCon ──(Bluetooth HID)──▶ WebHID
  device.open() + sendReport(0x01, …0x03 0x30)  → full report mode
  'inputreport' (0x30) ─▶ joyconReport.decodeButtons/decodeThrottle ─▶ InputFrame
                                                                          │
  keyboard ─▶ KeyInputSource ─▶ InputFrame ──▶ CompositeInputSource ◀────┘
                                                     │
                                                     ▶ ControlMapper + ScrollEngine (unchanged)
```

### Connect UX

WebHID's `requestDevice` requires a user gesture, so first-time connection needs one click
on the Connect button. After the grant, `getDevices()` finds the JoyCon on later loads and
auto-connects with no click. The HUD indicator shows whether a click is still needed.
Keyboard input works regardless.

### Error handling

- No WebHID (`!navigator.hid`, e.g. Firefox/Safari): the Connect button is hidden, the HUD
  shows disconnected, and keyboard input drives the app.
- Device disconnect mid-session: frame resets to neutral (scrolling stops), indicator flips
  to ○, Connect button reappears for reconnect.
- `requestDevice` cancelled or `open()` failure: logged; app stays usable via keyboard.

### Testing

- `joyconReport.ts` decoders are pure and fully unit-tested against synthetic report bytes
  (button bitmasks, stick thresholds, invert).
- `CompositeInputSource` is unit-tested with fake sources (button OR, first-non-zero stick).
- `ScrollEngine` / `ControlMapper` tests are unchanged and continue to pass.
- The WebHID I/O shell (`JoyConHidInputSource`) is not unit-testable (browser API + hardware)
  and is kept deliberately thin; it is verified hands-on with the device, including
  confirming the stick sign and setting `invertThrottle` accordingly.

### Documentation

- Replace `QJOYCONTROL-SETUP.md` with a WebHID guide: use Chrome or Edge, open the app, click
  **Connect Joy-Con** once and pick the Left JoyCon, done — no QJoyControl, no key mapping.
  Note the Chromium-only requirement and the keyboard fallback.
- Update `README.md`: input now comes from the JoyCon directly over WebHID (Chromium-only;
  keyboard fallback everywhere); refresh the controls description, prerequisites, and the
  input-flow section; update the project structure to list the new input files.

## Out of scope

- IMU/gyro data, rumble output, battery display.
- Right JoyCon and Pro Controller support (Left JoyCon only).
- Precise analog stick calibration (binary throttle only needs center + threshold).
- Non-Chromium browser support for the JoyCon (WebHID is Chromium-only; keyboard remains the
  cross-browser fallback).
