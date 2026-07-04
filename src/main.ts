import './styles.css';
import { CONFIG } from './config';
import { ControlMapper } from './control/ControlMapper';
import { ScrollEngine } from './scroll/ScrollEngine';
import { DocumentView } from './document/DocumentView';
import { nextParagraphOffset } from './document/paragraphs';
import { Hud } from './hud/Hud';
import { KeyInputSource } from './input/KeyInputSource';
import { JoyConHidInputSource } from './input/JoyConHidInputSource';
import { CompositeInputSource } from './input/CompositeInputSource';

const scroller = document.getElementById('scroller') as HTMLElement;
const docEl = document.getElementById('doc') as HTMLElement;
const dropZone = document.getElementById('drop-zone') as HTMLElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const hudEl = document.getElementById('hud') as HTMLElement;
const connectBtn = document.getElementById('connect-joycon') as HTMLButtonElement;

const view = new DocumentView(docEl);
const engine = new ScrollEngine();
const mapper = new ControlMapper();
const hud = new Hud(hudEl);

let invertThrottle = CONFIG.invertThrottle;
const joycon = new JoyConHidInputSource({ getInvert: () => invertThrottle });
const source = new CompositeInputSource([joycon, new KeyInputSource()]);
source.start();

connectBtn.addEventListener('click', () => { void joycon.connect(); });

// Flip the throttle direction from the HUD. Delegated because the HUD's innerHTML
// is rebuilt every frame, which would wipe a per-element listener.
hudEl.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('[data-action="flip-throttle"]')) {
    invertThrottle = !invertThrottle;
    markActivity(performance.now());
  }
});

// Reveal the auto-hiding HUD on mouse movement so its controls stay clickable.
window.addEventListener('mousemove', () => markActivity(performance.now()));

let fontSize = CONFIG.initialFontSize;
view.setFontSize(fontSize);

// ---- file loading ----
let loading = false;
async function loadFile(file: File) {
  if (loading) return;
  loading = true;
  try {
    await view.loadFile(file);
    dropZone.classList.add('hidden');
    scroller.scrollTop = 0;
    engine.stop();
  } catch (err) {
    console.error('Failed to load PDF:', err);
    dropZone.classList.remove('hidden');
    dropZone.textContent = 'Could not read that PDF. Click or drag another file.';
  } finally {
    loading = false;
  }
}
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  const f = fileInput.files?.[0];
  if (f) void loadFile(f);
});
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const f = e.dataTransfer?.files?.[0];
  if (f) void loadFile(f);
});

// ---- HUD auto-hide ----
let lastActivity = 0;
function markActivity(now: number) { lastActivity = now; hudEl.classList.remove('faded'); }

// ---- command handling ----
function applyCommand(cmd: ReturnType<ControlMapper['update']>[number]) {
  switch (cmd.type) {
    case 'toggleCruise':
      engine.toggleCruise();
      break;
    case 'maxSpeedStep':
      engine.stepMaxSpeed(cmd.delta);
      break;
    case 'sizeStep':
      fontSize = Math.max(CONFIG.minFontSize,
        Math.min(CONFIG.maxFontSize, fontSize + cmd.delta * CONFIG.fontSizeStep));
      view.setFontSize(fontSize);
      break;
    case 'seek': {
      const target = nextParagraphOffset(view.paragraphOffsets(), scroller.scrollTop, cmd.delta);
      scroller.scrollTop = target;
      break;
    }
  }
}

// ---- main loop ----
let prevTs: number | null = null;
function tick(ts: number) {
  const dt = prevTs === null ? 0 : (ts - prevTs) / 1000;
  prevTs = ts;

  const connected = joycon.isConnected();
  connectBtn.hidden = !navigator.hid || connected;

  const frame = source.getFrame();
  const cmds = mapper.update(frame);
  if (cmds.length) markActivity(ts);
  for (const cmd of cmds) applyCommand(cmd);

  const v = engine.velocity(frame.stick.y);
  if (v !== 0) markActivity(ts);
  const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  let pos = scroller.scrollTop + v * dt;
  if (pos <= 0) { pos = 0; }
  if (pos >= maxScroll) { pos = maxScroll; if (engine.state === 'CRUISE') engine.stop(); }
  scroller.scrollTop = pos;

  if (ts - lastActivity > CONFIG.hudHideMs) hudEl.classList.add('faded');

  hud.update({
    connected,
    state: engine.state,
    maxSpeed: engine.maxSpeed,
    fontSize,
    progress: maxScroll > 0 ? pos / maxScroll : 0,
    inverted: invertThrottle,
  });

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
