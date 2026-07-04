/**
 * Convert hard line breaks (`<br>`, from marked's `breaks: true`) into block-level line
 * spans so each line becomes an individually seekable element. Operates on `<br>`s that are
 * direct children of a block (marked's soft-break output), preserving inline formatting.
 */
export function splitHardBreakLines(root: HTMLElement): void {
  const blocks = new Set<HTMLElement>();
  root.querySelectorAll('br').forEach((br) => {
    if (br.parentElement) blocks.add(br.parentElement);
  });
  blocks.forEach(splitBlock);
}

function splitBlock(el: HTMLElement): void {
  const lines: Node[][] = [[]];
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeName === 'BR') {
      lines.push([]);
    } else {
      lines[lines.length - 1].push(node);
    }
  }
  if (lines.length < 2) return;
  const spans = lines.map((lineNodes) => {
    const span = document.createElement('span');
    span.className = 'tp-line';
    for (const n of lineNodes) span.appendChild(n);
    return span;
  });
  el.replaceChildren(...spans);
}
