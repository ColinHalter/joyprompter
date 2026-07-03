import type { InputFrame, ButtonState } from '../types';
import { NEUTRAL_FRAME } from '../types';
import type { InputSource } from './InputSource';
import { CONFIG } from '../config';
import { mouseRateToStick } from './mouseRateToStick';

/**
 * Live input from an unmodified QJoyControl:
 * - the analog stick drives OS mouse movement, captured here via Pointer Lock and
 *   converted (by rate) into a proportional throttle on stick.y;
 * - JoyCon buttons are mapped (in QJoyControl) to the keys in CONFIG.keyMap.
 */
export class QJoyControlInputSource implements InputSource {
  private frame: InputFrame = structuredClone(NEUTRAL_FRAME);
  private accumY = 0;
  private lastSample: number | null = null;

  constructor(private target: HTMLElement) {}

  private onMouseMove = (e: MouseEvent): void => {
    if (document.pointerLockElement === this.target) {
      this.accumY += e.movementY;
    }
  };
  private onKeyDown = (e: KeyboardEvent): void => this.setKey(e.key, true);
  private onKeyUp = (e: KeyboardEvent): void => this.setKey(e.key, false);

  getFrame(): InputFrame {
    const now = performance.now();
    const dt = this.lastSample === null ? 0 : (now - this.lastSample) / 1000;
    this.lastSample = now;
    this.frame.stick.y = mouseRateToStick(
      this.accumY, dt, CONFIG.mouseFullThrottleRate, CONFIG.invertThrottle,
    );
    this.frame.stick.x = 0;
    this.accumY = 0;
    return this.frame;
  }

  isConnected(): boolean {
    return document.pointerLockElement === this.target;
  }

  start(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mousemove', this.onMouseMove);
  }

  stop(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('mousemove', this.onMouseMove);
  }

  /** Request Pointer Lock. MUST be called from a user gesture (e.g. a click). */
  engage(): void {
    void this.target.requestPointerLock();
  }

  private setKey(key: string, down: boolean): void {
    const btn: keyof ButtonState | undefined = CONFIG.keyMap[key];
    if (btn) this.frame.buttons[btn] = down;
  }
}
