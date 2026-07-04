// Minimal WebHID declarations — only what this app uses.
// Full spec: https://wicg.github.io/webhid/
interface HIDDevice extends EventTarget {
  readonly opened: boolean;
  readonly vendorId: number;
  readonly productId: number;
  readonly productName: string;
  open(): Promise<void>;
  close(): Promise<void>;
  // Widened from the DOM lib's `BufferSource` (which pins ArrayBufferView<ArrayBuffer>)
  // so plain `new Uint8Array(...)` values (typed ArrayBufferView<ArrayBufferLike>
  // under TS 5.7+'s generic typed-array libs) are assignable without a cast.
  sendReport(reportId: number, data: ArrayBuffer | ArrayBufferView): Promise<void>;
  addEventListener(type: 'inputreport', listener: (e: HIDInputReportEvent) => void): void;
  removeEventListener(type: 'inputreport', listener: (e: HIDInputReportEvent) => void): void;
}

interface HIDInputReportEvent extends Event {
  readonly device: HIDDevice;
  readonly reportId: number;
  readonly data: DataView;
}

interface HIDConnectionEvent extends Event {
  readonly device: HIDDevice;
}

interface HIDDeviceFilter {
  vendorId?: number;
  productId?: number;
}

interface HID extends EventTarget {
  getDevices(): Promise<HIDDevice[]>;
  requestDevice(options: { filters: HIDDeviceFilter[] }): Promise<HIDDevice[]>;
  addEventListener(type: 'connect' | 'disconnect', listener: (e: HIDConnectionEvent) => void): void;
  removeEventListener(type: 'connect' | 'disconnect', listener: (e: HIDConnectionEvent) => void): void;
}

interface Navigator {
  readonly hid?: HID;
}
