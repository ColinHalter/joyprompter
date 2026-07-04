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
