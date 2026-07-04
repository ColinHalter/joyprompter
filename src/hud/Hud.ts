import type { ScrollState } from '../types';

export function stateLabel(state: ScrollState): string {
  switch (state) {
    case 'HOLD': return 'Paused';
    case 'MANUAL': return 'Manual';
    case 'CRUISE': return 'Cruise';
  }
}

export interface HudModel {
  connected: boolean;
  state: ScrollState;
  maxSpeed: number;
  fontSize: number;
  progress: number; // 0..1
}

export class Hud {
  constructor(private el: HTMLElement) {}

  update(m: HudModel): void {
    const pct = Math.round(m.progress * 100);
    this.el.innerHTML = `
      <span class="hud-item ${m.connected ? 'ok' : 'bad'}">${m.connected ? 'Joy-Con ●' : 'Joy-Con ○'}</span>
      <span class="hud-item">${stateLabel(m.state)}</span>
      <span class="hud-item">Max ${Math.round(m.maxSpeed)} px/s</span>
      <span class="hud-item">Text ${Math.round(m.fontSize)} px</span>
      <span class="hud-item">${pct}%</span>
    `;
  }
}
