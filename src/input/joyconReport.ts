import type { ButtonState } from '../types';

/** Nintendo vendor id and the Left JoyCon product id (WebHID device filter). */
export const NINTENDO_VENDOR_ID = 0x057e;
export const JOYCON_L_PRODUCT_ID = 0x2006;

/** Nominal analog-stick center for a 12-bit axis (0..4095). Binary throttle needs no calibration. */
export const STICK_CENTER = 2048;

/**
 * Decode the Left JoyCon buttons from a standard full-mode (0x30) report.
 * WebHID strips the reportId, so the left-button byte is at index 4 and the
 * shared-button byte (which holds Capture) is at index 3.
 */
export function decodeButtons(data: DataView): ButtonState {
  const b = data.getUint8(4);
  const shared = data.getUint8(3);
  return {
    down: !!(b & 0x01),
    up: !!(b & 0x02),
    right: !!(b & 0x04),
    left: !!(b & 0x08),
    sr: !!(b & 0x10),
    sl: !!(b & 0x20),
    zl: !!(b & 0x80),
    capture: !!(shared & 0x20),
  };
}

/**
 * Decode the vertical stick value into a binary throttle direction.
 * The 12-bit vertical axis is packed across bytes 6 (high nibble) and 7.
 */
export function decodeThrottle(
  data: DataView,
  opts: { threshold: number; invert: boolean },
): -1 | 0 | 1 {
  const vertical = (data.getUint8(6) >> 4) | (data.getUint8(7) << 4);
  const delta = vertical - STICK_CENTER;
  let dir: -1 | 0 | 1 = 0;
  if (delta > opts.threshold) dir = 1;
  else if (delta < -opts.threshold) dir = -1;
  return opts.invert ? ((-dir) as -1 | 0 | 1) : dir;
}

/**
 * Output report 0x01 payload that switches the JoyCon into standard full report mode (0x30):
 * a packet counter (low nibble), the neutral-rumble preamble, then subcommand 0x03 arg 0x30.
 */
export function fullReportModeReport(packetNumber: number): Uint8Array {
  return new Uint8Array([
    packetNumber & 0x0f,
    0x00, 0x01, 0x40, 0x40, 0x00, 0x01, 0x40, 0x40,
    0x03,
    0x30,
  ]);
}
