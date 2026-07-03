import type { InputFrame, ButtonState } from '../types';
import { NEUTRAL_FRAME } from '../types';
import type { InputSource } from './InputSource';
import { CONFIG } from '../config';

/**
 * Hardware-free dev/testing source. Arrow Up/Down simulate the throttle stick;
 * the CONFIG.keyMap keys (i/k/j/l/q/e/c by default) simulate the buttons.
 */
export class KeyboardInputSource implements InputSource {
  private frame: InputFrame = structuredClone(NEUTRAL_FRAME);
  private onKeyDown = (e: KeyboardEvent) => this.setKey(e.key, true);
  private onKeyUp = (e: KeyboardEvent) => this.setKey(e.key, false);

  getFrame(): InputFrame {
    return this.frame;
  }

  isConnected(): boolean {
    return true;
  }

  start(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  stop(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  private setKey(key: string, down: boolean): void {
    if (key === 'ArrowUp') { this.frame.stick.y = down ? 1 : 0; return; }
    if (key === 'ArrowDown') { this.frame.stick.y = down ? -1 : 0; return; }
    const btn: keyof ButtonState | undefined = CONFIG.keyMap[key];
    if (btn) this.frame.buttons[btn] = down;
  }
}
