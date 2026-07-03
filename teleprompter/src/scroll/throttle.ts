export function applyDeadzone(value: number, deadzone: number): number {
  const mag = Math.abs(value);
  if (mag <= deadzone) return 0;
  const sign = Math.sign(value);
  return (sign * (mag - deadzone)) / (1 - deadzone);
}
