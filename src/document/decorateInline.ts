/**
 * Style teleprompter-specific inline markers in rendered markdown:
 *   ==text==  → <mark> (yellow highlight)
 *   [text]    → <span class="tp-bracket"> (purple, brackets kept)
 * Walks text nodes only, skipping code / pre / link text, so code spans and real
 * link labels are never touched.
 */
const RULE = /==([^=]+)==|\[([^\]\n]+)\]/;
const SKIP_TAGS = new Set(['CODE', 'PRE', 'A', 'MARK']);

export function decorateInline(root: HTMLElement): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const targets: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    if (isSkipped(text.parentElement, root)) continue;
    if (unclosedLine(text) !== null || RULE.test(text.data)) targets.push(text);
  }
  for (const text of targets) decorate(text);
}

function isSkipped(el: Element | null, root: HTMLElement): boolean {
  for (let cur = el; cur && cur !== root; cur = cur.parentElement) {
    if (SKIP_TAGS.has(cur.tagName)) return true;
  }
  return false;
}

/** A text node is at a line start if it opens its block or directly follows a hard break. */
function atLineStart(node: Text): boolean {
  const prev = node.previousSibling;
  return prev === null || prev.nodeName === 'BR';
}

/**
 * A line that starts with `==` (after optional whitespace) and never closes it:
 * the whole line is highlighted and the leading `==` dropped. Returns null otherwise
 * (a closing `==` present → handled as an inline `==x==` instead).
 */
function unclosedLine(node: Text): { ws: string; rest: string } | null {
  if (!atLineStart(node)) return null;
  const m = /^(\s*)==(.+)$/.exec(node.data);
  if (!m || m[2].includes('==')) return null;
  return { ws: m[1], rest: m[2] };
}

function highlight(text: string): HTMLElement {
  const mark = document.createElement('mark');
  mark.textContent = text;
  return mark;
}

function decorate(node: Text): void {
  const line = unclosedLine(node);
  if (line) {
    const frag = document.createDocumentFragment();
    if (line.ws) frag.appendChild(document.createTextNode(line.ws));
    frag.appendChild(highlight(line.rest));
    node.replaceWith(frag);
    return;
  }
  const frag = document.createDocumentFragment();
  let rest = node.data;
  let m: RegExpExecArray | null;
  while ((m = RULE.exec(rest)) !== null) {
    if (m.index > 0) frag.appendChild(document.createTextNode(rest.slice(0, m.index)));
    if (m[1] !== undefined) {
      frag.appendChild(highlight(m[1]));
    } else {
      const span = document.createElement('span');
      span.className = 'tp-bracket';
      span.textContent = m[0]; // full match, brackets included
      frag.appendChild(span);
    }
    rest = rest.slice(m.index + m[0].length);
  }
  if (rest) frag.appendChild(document.createTextNode(rest));
  node.replaceWith(frag);
}
