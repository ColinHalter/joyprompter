import type { InputFrame, ButtonState } from '../types';
import { NEUTRAL_FRAME } from '../types';
import type { InputSource } from './InputSource';
import { CONFIG } from '../config';

/**
 * Keyboard input source — the fallback when no JoyCon is connected (and the only
 * option in non-Chromium browsers). ArrowUp / ArrowDown are the binary throttle
 * (stick up / down), and the CONFIG.keyMap keys are the buttons.
 */
export class KeyInputSource implements InputSource {
  private frame: InputFrame = structuredClone(NEUTRAL_FRAME);
  private upHeld = false;
  private downHeld = false;
  private onKeyDown = (e: KeyboardEvent) => this.setKey(e.key, true);
  private onKeyUp = (e: KeyboardEvent) => this.setKey(e.key, false);

  getFrame(): InputFrame {
    return this.frame;
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
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      if (key === 'ArrowUp') this.upHeld = down;
      else this.downHeld = down;
      this.frame.stick.y = (this.upHeld ? 1 : 0) - (this.downHeld ? 1 : 0);
      return;
    }
    const btn: keyof ButtonState | undefined = CONFIG.keyMap[key];
    if (btn) this.frame.buttons[btn] = down;
  }
}
