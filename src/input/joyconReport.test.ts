import { describe, it, expect } from 'vitest';
import {
  STICK_CENTER,
  decodeButtons,
  decodeThrottle,
  fullReportModeReport,
} from './joyconReport';

/** Build a synthetic 0x30 report body (reportId already stripped, as WebHID delivers it). */
function report({ buttons = 0, vertical = STICK_CENTER }: { buttons?: number; vertical?: number }): DataView {
  const bytes = new Uint8Array(12);
  bytes[4] = buttons; // left-button byte
  bytes[6] = (vertical & 0x0f) << 4; // stick low nibble -> high nibble of byte 6
  bytes[7] = (vertical >> 4) & 0xff;  // stick high 8 bits
  return new DataView(bytes.buffer);
}

describe('decodeButtons', () => {
  it('maps each left-JoyCon button bit to its ButtonState field', () => {
    expect(decodeButtons(report({ buttons: 0x02 })).up).toBe(true);
    expect(decodeButtons(report({ buttons: 0x01 })).down).toBe(true);
    expect(decodeButtons(report({ buttons: 0x04 })).right).toBe(true);
    expect(decodeButtons(report({ buttons: 0x08 })).left).toBe(true);
    expect(decodeButtons(report({ buttons: 0x10 })).sr).toBe(true);
    expect(decodeButtons(report({ buttons: 0x20 })).sl).toBe(true);
    expect(decodeButtons(report({ buttons: 0x80 })).zl).toBe(true);
  });
  it('reports all-false when no bits are set', () => {
    expect(decodeButtons(report({}))).toEqual({
      up: false, down: false, left: false, right: false, sl: false, sr: false, zl: false,
    });
  });
});

describe('decodeThrottle', () => {
  const opts = { threshold: 700, invert: false };
  it('returns 0 at rest (center)', () => {
    expect(decodeThrottle(report({ vertical: STICK_CENTER }), opts)).toBe(0);
  });
  it('returns +1 when pushed well above center', () => {
    expect(decodeThrottle(report({ vertical: STICK_CENTER + 900 }), opts)).toBe(1);
  });
  it('returns -1 when pushed well below center', () => {
    expect(decodeThrottle(report({ vertical: STICK_CENTER - 900 }), opts)).toBe(-1);
  });
  it('returns 0 within the threshold deadzone', () => {
    expect(decodeThrottle(report({ vertical: STICK_CENTER + 100 }), opts)).toBe(0);
  });
  it('flips direction when invert is true', () => {
    expect(decodeThrottle(report({ vertical: STICK_CENTER + 900 }), { threshold: 700, invert: true })).toBe(-1);
  });
});

describe('fullReportModeReport', () => {
  it('builds the 0x01 output payload with the packet nibble and 0x03/0x30 subcommand', () => {
    expect(Array.from(fullReportModeReport(1))).toEqual([
      1, 0x00, 0x01, 0x40, 0x40, 0x00, 0x01, 0x40, 0x40, 0x03, 0x30,
    ]);
  });
  it('masks the packet number to its low nibble', () => {
    expect(fullReportModeReport(0x11)[0]).toBe(1);
  });
});
