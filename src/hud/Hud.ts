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
  inverted: boolean;
}

export class Hud {
  private lastHtml = '';
  constructor(private el: HTMLElement) {}

  update(m: HudModel): void {
    const pct = Math.round(m.progress * 100);
    const html = `
      <span class="hud-item ${m.connected ? 'ok' : 'bad'}">${m.connected ? 'Joy-Con ●' : 'Joy-Con ○'}</span>
      <span class="hud-item">${stateLabel(m.state)}</span>
      <span class="hud-item">Max ${Math.round(m.maxSpeed)} px/s</span>
      <span class="hud-item">Text ${Math.round(m.fontSize)} px</span>
      <span class="hud-item">${pct}%</span>
      <span class="hud-item hud-toggle" data-action="flip-throttle">${m.inverted ? '↑ = reverse' : '↑ = forward'}</span>
    `;
    // Only touch the DOM when the rendered content changes. Rebuilding innerHTML every
    // frame would destroy and recreate the clickable toggle span mid-click, so the click
    // gesture's mousedown/mouseup would land on different nodes and never activate it.
    if (html === this.lastHtml) return;
    this.lastHtml = html;
    this.el.innerHTML = html;
  }
}
