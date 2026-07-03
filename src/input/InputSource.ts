import type { InputFrame } from '../types';

export interface InputSource {
  /** Latest controller state; NEUTRAL_FRAME when idle. */
  getFrame(): InputFrame;
  start(): void;
  stop(): void;
}
