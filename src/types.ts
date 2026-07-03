export interface StickState {
  x: number; // -1..1
  y: number; // -1..1, positive = up = scroll forward
}

export interface ButtonState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  sl: boolean;
  sr: boolean;
  stickClick: boolean;
}

export interface InputFrame {
  stick: StickState;
  buttons: ButtonState;
}

export type Command =
  | { type: 'toggleCruise' }
  | { type: 'sizeStep'; delta: 1 | -1 }
  | { type: 'seek'; delta: 1 | -1 }
  | { type: 'maxSpeedStep'; delta: 1 | -1 };

export type ScrollState = 'HOLD' | 'MANUAL' | 'CRUISE';

export const NEUTRAL_FRAME: InputFrame = {
  stick: { x: 0, y: 0 },
  buttons: {
    up: false, down: false, left: false, right: false,
    sl: false, sr: false, stickClick: false,
  },
};
