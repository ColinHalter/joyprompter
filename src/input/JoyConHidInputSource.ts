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
 * Reads a Left JoyCon directly over WebHID. The first connect needs a user
 * gesture (the Connect button); afterwards the granted device reconnects
 * silently via the 'connect' event and getDevices(). When WebHID is
 * unavailable the source is inert and the keyboard fallback drives the app.
 */
export class JoyConHidInputSource implements InputSource {
  private frame: InputFrame = structuredClone(NEUTRAL_FRAME);
  private device: HIDDevice | null = null;
  private packet = 0;

  constructor(private opts: { getInvert: () => boolean }) {}

  private onInputReport = (e: HIDInputReportEvent): void => {
    if (e.reportId !== FULL_REPORT_ID) return;
    this.frame.buttons = decodeButtons(e.data);
    this.frame.stick.y = decodeThrottle(e.data, {
      threshold: CONFIG.stickThreshold,
      invert: this.opts.getInvert(),
    });
  };

  private onConnect = (e: HIDConnectionEvent): void => {
    if (!this.device && this.matches(e.device)) void this.initDevice(e.device);
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
    hid.addEventListener('connect', this.onConnect);
    hid.addEventListener('disconnect', this.onDisconnect);
    void hid
      .getDevices()
      .then((devices) => {
        const existing = devices.find((d) => this.matches(d));
        if (existing) return this.initDevice(existing);
      })
      .catch((err) => console.error('JoyCon auto-connect failed:', err));
  }

  /** Must be called from a user gesture (the Connect button click). */
  async connect(): Promise<void> {
    const hid = navigator.hid;
    if (!hid) return;
    try {
      const [device] = await hid.requestDevice({
        filters: [{ vendorId: NINTENDO_VENDOR_ID, productId: JOYCON_L_PRODUCT_ID }],
      });
      if (device) await this.initDevice(device);
    } catch (err) {
      console.error('JoyCon connect failed:', err);
    }
  }

  stop(): void {
    const hid = navigator.hid;
    if (hid) {
      hid.removeEventListener('connect', this.onConnect);
      hid.removeEventListener('disconnect', this.onDisconnect);
    }
    this.reset();
  }

  private matches(device: HIDDevice): boolean {
    return device.vendorId === NINTENDO_VENDOR_ID && device.productId === JOYCON_L_PRODUCT_ID;
  }

  private async initDevice(device: HIDDevice): Promise<void> {
    this.reset(); // tear down any previously-tracked device first
    try {
      if (!device.opened) await device.open();
      device.addEventListener('inputreport', this.onInputReport);
      this.device = device;
      this.packet = (this.packet + 1) & 0x0f;
      await device.sendReport(OUTPUT_REPORT_ID, fullReportModeReport(this.packet));
    } catch (err) {
      console.error('JoyCon initialization failed:', err);
      this.reset();
    }
  }

  private reset(): void {
    if (this.device) {
      this.device.removeEventListener('inputreport', this.onInputReport);
      void this.device.close().catch(() => {});
      this.device = null;
    }
    this.frame = structuredClone(NEUTRAL_FRAME);
  }
}
