import type { InputFrame } from '../types';
import { NEUTRAL_FRAME } from '../types';
import type { InputSource } from './InputSource';
import { CONFIG } from '../config';
import {
  NINTENDO_VENDOR_ID,
  JOYCON_L_PRODUCT_ID,
  decodeButtons,
  decodeThrottle,
  fullReportModeReport,
} from './joyconReport';

const FULL_REPORT_ID = 0x30;
const OUTPUT_REPORT_ID = 0x01;

/**
 * Reads a Left JoyCon directly over WebHID. On the first connect the user must
 * click (WebHID requires a gesture); afterwards getDevices() reconnects silently.
 * When WebHID is unavailable the source is inert and the keyboard fallback drives the app.
 */
export class JoyConHidInputSource implements InputSource {
  private frame: InputFrame = structuredClone(NEUTRAL_FRAME);
  private device: HIDDevice | null = null;
  private packet = 0;

  private onInputReport = (e: HIDInputReportEvent): void => {
    if (e.reportId !== FULL_REPORT_ID) return;
    this.frame.buttons = decodeButtons(e.data);
    this.frame.stick.y = decodeThrottle(e.data, {
      threshold: CONFIG.stickThreshold,
      invert: CONFIG.invertThrottle,
    });
  };

  private onDisconnect = (e: HIDConnectionEvent): void => {
    if (e.device === this.device) this.reset();
  };

  getFrame(): InputFrame {
    return this.frame;
  }

  isConnected(): boolean {
    return this.device?.opened ?? false;
  }

  start(): void {
    const hid = navigator.hid;
    if (!hid) return; // WebHID unsupported — keyboard fallback still works
    hid.addEventListener('disconnect', this.onDisconnect);
    void hid.getDevices().then((devices) => {
      const existing = devices.find(
        (d) => d.vendorId === NINTENDO_VENDOR_ID && d.productId === JOYCON_L_PRODUCT_ID,
      );
      if (existing) void this.initDevice(existing);
    });
  }

  /** Must be called from a user gesture (the Connect button click). */
  async connect(): Promise<void> {
    const hid = navigator.hid;
    if (!hid) return;
    const [device] = await hid.requestDevice({
      filters: [{ vendorId: NINTENDO_VENDOR_ID, productId: JOYCON_L_PRODUCT_ID }],
    });
    if (device) await this.initDevice(device);
  }

  stop(): void {
    const hid = navigator.hid;
    if (hid) hid.removeEventListener('disconnect', this.onDisconnect);
    if (this.device) void this.device.close();
    this.reset();
  }

  private async initDevice(device: HIDDevice): Promise<void> {
    this.device = device;
    if (!device.opened) await device.open();
    device.addEventListener('inputreport', this.onInputReport);
    this.packet = (this.packet + 1) & 0x0f;
    await device.sendReport(OUTPUT_REPORT_ID, fullReportModeReport(this.packet));
  }

  private reset(): void {
    if (this.device) this.device.removeEventListener('inputreport', this.onInputReport);
    this.device = null;
    this.frame = structuredClone(NEUTRAL_FRAME);
  }
}
