import type { InputFrame } from '../types';

export interface InputSource {
  /** Latest controller state; NEUTRAL_FRAME when idle/disconnected. */
  getFrame(): InputFrame;
  /** True when a live source is connected (always true for the keyboard source). */
  isConnected(): boolean;
  start(): void;
  stop(): void;
}
