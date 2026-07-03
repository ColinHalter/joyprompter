import type { InputFrame, ButtonState } from '../types';
import { NEUTRAL_FRAME } from '../types';
import type { InputSource } from './InputSource';

/**
 * Merges several input sources into one frame: buttons are OR'd across all
 * sources, and stick.y is taken from the first source (in constructor order)
 * that is deflected. Lets the JoyCon and keyboard drive the app simultaneously.
 */
export class CompositeInputSource implements InputSource {
  constructor(private sources: InputSource[]) {}

  start(): void {
    for (const s of this.sources) s.start();
  }

  stop(): void {
    for (const s of this.sources) s.stop();
  }

  getFrame(): InputFrame {
    const buttons: ButtonState = { ...NEUTRAL_FRAME.buttons };
    let stickY = 0;
    for (const s of this.sources) {
      const f = s.getFrame();
      for (const key of Object.keys(buttons) as (keyof ButtonState)[]) {
        if (f.buttons[key]) buttons[key] = true;
      }
      if (stickY === 0 && f.stick.y !== 0) stickY = f.stick.y;
    }
    return { stick: { x: 0, y: stickY }, buttons };
  }
}
