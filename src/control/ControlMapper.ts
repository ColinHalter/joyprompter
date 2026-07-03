import type { InputFrame, Command, ButtonState } from '../types';
import { NEUTRAL_FRAME } from '../types';

export class ControlMapper {
  private prev: InputFrame = NEUTRAL_FRAME;

  update(frame: InputFrame): Command[] {
    const cmds: Command[] = [];
    const pressed = (b: keyof ButtonState): boolean =>
      frame.buttons[b] && !this.prev.buttons[b];

    if (pressed('zl')) cmds.push({ type: 'toggleCruise' });
    if (pressed('up')) cmds.push({ type: 'maxSpeedStep', delta: 1 });
    if (pressed('down')) cmds.push({ type: 'maxSpeedStep', delta: -1 });
    if (pressed('right')) cmds.push({ type: 'seek', delta: 1 });
    if (pressed('left')) cmds.push({ type: 'seek', delta: -1 });
    if (pressed('sr')) cmds.push({ type: 'sizeStep', delta: 1 });
    if (pressed('sl')) cmds.push({ type: 'sizeStep', delta: -1 });

    this.prev = structuredClone(frame);
    return cmds;
  }
}
