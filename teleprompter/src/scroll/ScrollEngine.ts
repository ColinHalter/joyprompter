import type { ScrollState } from '../types';
import { applyDeadzone } from './throttle';
import { CONFIG } from '../config';

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export class ScrollEngine {
  state: ScrollState = 'HOLD';
  maxSpeed: number;
  private deadzone: number;

  constructor(opts?: { maxSpeed?: number; deadzone?: number }) {
    this.maxSpeed = opts?.maxSpeed ?? CONFIG.initialMaxSpeed;
    this.deadzone = opts?.deadzone ?? CONFIG.deadzone;
  }

  toggleCruise(): void {
    this.state = this.state === 'CRUISE' ? 'HOLD' : 'CRUISE';
  }

  stop(): void {
    this.state = 'HOLD';
  }

  stepMaxSpeed(delta: 1 | -1): void {
    this.maxSpeed = clamp(
      this.maxSpeed + delta * CONFIG.maxSpeedStep,
      CONFIG.minMaxSpeed,
      CONFIG.maxMaxSpeed,
    );
  }

  /** Velocity in px/s (positive = forward/down). Updates state from stick input. */
  velocity(stickY: number): number {
    const deflection = applyDeadzone(stickY, this.deadzone);
    if (this.state === 'CRUISE') {
      if (deflection !== 0) {
        this.state = 'MANUAL';
        return deflection * this.maxSpeed;
      }
      return this.maxSpeed;
    }
    if (deflection !== 0) {
      this.state = 'MANUAL';
      return deflection * this.maxSpeed;
    }
    this.state = 'HOLD';
    return 0;
  }
}
