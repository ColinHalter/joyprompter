# Driving the teleprompter with a Left JoyCon + QJoyControl

The teleprompter needs no special QJoyControl build — configure the stock app once.

## 1. Connect the JoyCon
Pair and connect the Left JoyCon over Bluetooth, then select it in QJoyControl and
click Connect (see QJoyControl's own README).

## 2. Map the stick to the arrow keys (the throttle)
The throttle is binary: any up push scrolls forward at the max speed, any down push
scrolls backward, centered holds. In QJoyControl, bind the **Left stick** so pushing it
up sends the **Up arrow** key and pushing it down sends the **Down arrow** key (use
QJoyControl's stick-direction / threshold binding, not the analog-mouse feature). Leave
**analog mouse** and **gyro mouse** disabled.

## 3. Map the inputs to these keys
Configure QJoyControl's input-to-key mapping for the Left JoyCon as follows:

| Left JoyCon input | Key | Teleprompter action         |
|-------------------|-----|-----------------------------|
| Stick Up          | ↑   | Scroll forward (max speed)  |
| Stick Down        | ↓   | Scroll backward (max speed) |
| D-pad Up          | i   | Increase max scroll speed   |
| D-pad Down        | k   | Decrease max scroll speed   |
| D-pad Left        | j   | Seek back one paragraph     |
| D-pad Right       | l   | Seek forward one paragraph  |
| SL                | q   | Text size down              |
| SR                | e   | Text size up                |
| ZL                | z   | Toggle cruise (auto-scroll) |

(The button keys are defined in `src/config.ts` as `CONFIG.keyMap`; the throttle uses the
fixed Arrow Up / Arrow Down keys. Change both here and in the app if you prefer different
keys.)

## 4. Use it
1. Open the teleprompter (`npm run dev`, then the printed URL) and load a PDF.
2. Drive it (no engage step — the app responds to input immediately):
   - **Stick up / down** — scroll forward / reverse at the max speed (release to hold).
   - **ZL** — toggle cruise (hands-free scroll at the max speed).
   - **D-pad up / down** — increase / decrease max scroll speed.
   - **D-pad left / right** — seek by paragraph; **SL / SR** — text size down / up.

## Tuning
The throttle is binary, so there is no speed sensitivity to tune — set the pace with the
D-pad (max speed) and ZL (cruise). If the stick's up/down don't register reliably, adjust
QJoyControl's stick-direction threshold. Up is always forward, so there is no invert
setting.
