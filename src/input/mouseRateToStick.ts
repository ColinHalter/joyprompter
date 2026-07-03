// src/input/mouseRateToStick.ts

/**
 * Convert accumulated Pointer-Lock vertical mouse movement over a frame into a
 * normalized throttle value in [-1, 1].
 *
 * Screen Y grows downward, so moving the mouse UP yields negative movementY.
 * Up = scroll forward = positive stick, hence the leading minus sign.
 *
 * @param accumMovementY   summed event.movementY since the last frame (px)
 * @param dtSeconds        elapsed time since the last frame (s)
 * @param fullThrottleRate mouse rate (px/s) that corresponds to full throttle
 * @param invert           flip the sign if the mouse Y axis is inverted
 */
export function mouseRateToStick(
  accumMovementY: number,
  dtSeconds: number,
  fullThrottleRate: number,
  invert = false,
): number {
  if (dtSeconds <= 0 || fullThrottleRate <= 0) return 0;
  const rate = accumMovementY / dtSeconds; // px/s; negative = moving up
  let stick = -rate / fullThrottleRate;
  if (invert) stick = -stick;
  return Math.max(-1, Math.min(1, stick));
}
