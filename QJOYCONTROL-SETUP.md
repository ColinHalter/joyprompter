# Driving the teleprompter with a Left JoyCon + QJoyControl

The teleprompter needs no special QJoyControl build — configure the stock app once.

## 1. Connect the JoyCon
Pair and connect the Left JoyCon over Bluetooth, then select it in QJoyControl and
click Connect (see QJoyControl's own README).

## 2. Enable the stick-as-mouse (the throttle)
In QJoyControl, enable **Left analog mouse** so the analog stick moves the mouse
cursor. Adjust the analog sensitivity slider so a full stick push moves the cursor
at a comfortably fast, steady rate. Disable **Gyro mouse** so only the stick moves
the cursor.

## 3. Map the buttons to these keys
Configure QJoyControl's button-to-key mapping for the Left JoyCon as follows:

| Left JoyCon input | Key | Teleprompter action        |
|-------------------|-----|----------------------------|
| D-pad Up          | i   | Increase max scroll speed  |
| D-pad Down        | k   | Decrease max scroll speed  |
| D-pad Left        | j   | Seek back one paragraph    |
| D-pad Right       | l   | Seek forward one paragraph |
| SL                | q   | Text size down             |
| SR                | e   | Text size up               |
| ZL                | z   | Toggle cruise (auto-scroll)|

(These keys are defined in `src/config.ts` as `CONFIG.keyMap` — change both places
if you prefer different keys.)

## 4. Use it
1. Open the teleprompter (`npm run dev`, then the printed URL) and load a PDF.
2. **Click the text area once** to engage Pointer Lock (this lets the browser read
   the stick-as-mouse without the cursor hitting screen edges). Press **Esc** to
   release; click again to re-engage. The HUD shows "Controller ●" when engaged.
3. Drive it:
   - **Stick up / down** — scroll forward / reverse; how far you push sets the speed.
   - **ZL** — toggle cruise (hands-free scroll at the max speed).
   - **D-pad up / down** — increase / decrease max scroll speed.
   - **D-pad left / right** — seek by paragraph; **SL / SR** — text size down / up.

## Tuning
If the throttle feels too fast/slow, adjust QJoyControl's analog sensitivity and/or
`CONFIG.mouseFullThrottleRate` in `src/config.ts` (the mouse rate that equals full
throttle). If up/down are reversed, set `CONFIG.invertThrottle = true`.
