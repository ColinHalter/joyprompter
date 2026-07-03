import './styles.css';
import { CONFIG } from './config';
import { ControlMapper } from './control/ControlMapper';
import { ScrollEngine } from './scroll/ScrollEngine';
import { DocumentView } from './document/DocumentView';
import { nextParagraphOffset } from './document/paragraphs';
import { Hud } from './hud/Hud';
import type { InputSource } from './input/InputSource';
import { QJoyControlInputSource } from './input/QJoyControlInputSource';
import { KeyInputSource } from './input/KeyInputSource';

const scroller = document.getElementById('scroller') as HTMLElement;
const docEl = document.getElementById('doc') as HTMLElement;
const dropZone = document.getElementById('drop-zone') as HTMLElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const hudEl = document.getElementById('hud') as HTMLElement;

const view = new DocumentView(docEl);
const engine = new ScrollEngine();
const mapper = new ControlMapper();
const hud = new Hud(hudEl);

const useKeyboard = new URLSearchParams(location.search).get('input') === 'keyboard';
let engage: (() => void) | null = null;
let source: InputSource;
if (useKeyboard) {
  source = new KeyInputSource();
} else {
  const qjc = new QJoyControlInputSource(scroller);
  source = qjc;
  engage = () => qjc.engage();
}
source.start();

// Click the scroller to engage Pointer Lock (captures the stick-as-mouse).
scroller.addEventListener('click', () => {
  if (engage && document.pointerLockElement !== scroller) engage();
});

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
    connected: source.isConnected(),
    state: engine.state,
    maxSpeed: engine.maxSpeed,
    fontSize,
    progress: maxScroll > 0 ? pos / maxScroll : 0,
  });

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
