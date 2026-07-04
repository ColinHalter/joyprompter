# Markdown File Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load `.md` files, parse them with `marked` (preserving line breaks), and render them as a formatted left-aligned document that scrolls and seeks like the PDF view — with a trust-confirmation prompt before loading markdown.

**Architecture:** `DocumentView` becomes a dispatcher: a pure `fileKind(file)` routes markdown to `renderMarkdownToHtml` (marked) and everything else to `extractPdfParagraphs` (pdf.js, moved out of DocumentView). Markdown renders left-aligned under a `#doc.md` class; `main.ts` shows a `window.confirm` warning before loading markdown.

**Tech Stack:** TypeScript · Vite · Vitest (jsdom, globals) · pdf.js · marked

**Design doc:** [docs/superpowers/specs/2026-07-04-markdown-support-design.md](../specs/2026-07-04-markdown-support-design.md)

---

## File overview

- `src/document/fileType.ts` (+ test) — pure `fileKind(file)`.
- `src/document/markdown.ts` (+ test) — `renderMarkdownToHtml(md)` (marked wrapper).
- `src/document/pdf.ts` — `extractPdfParagraphs(file)` (moved from DocumentView).
- `src/document/DocumentView.ts` — dispatcher + two render modes.
- `src/styles.css` — `#doc.md` (+ light) markdown styling.
- `src/main.ts` — `fileKind` import + confirm dialog + generalized error text.
- `index.html` — file-input `accept` + drop-zone text.
- `package.json` / `package-lock.json` — add `marked`.
- `README.md` — features/launch/structure/tech.

---

## Task 1: File-type classifier (TDD)

**Files:**
- Create: `src/document/fileType.ts`
- Test: `src/document/fileType.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/document/fileType.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { fileKind } from './fileType';

describe('fileKind', () => {
  it('detects markdown by extension', () => {
    expect(fileKind({ name: 'script.md', type: '' })).toBe('markdown');
    expect(fileKind({ name: 'NOTES.MARKDOWN', type: '' })).toBe('markdown');
  });
  it('detects markdown by MIME type', () => {
    expect(fileKind({ name: 'noext', type: 'text/markdown' })).toBe('markdown');
  });
  it('treats PDFs and everything else as pdf', () => {
    expect(fileKind({ name: 'doc.pdf', type: 'application/pdf' })).toBe('pdf');
    expect(fileKind({ name: 'mystery', type: '' })).toBe('pdf');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/document/fileType.test.ts`
Expected: FAIL — cannot resolve `'./fileType'`.

- [ ] **Step 3: Write the implementation**

Create `src/document/fileType.ts`:

```ts
export type FileKind = 'pdf' | 'markdown';

/** Classify a file as markdown (.md/.markdown or text/markdown) or pdf (the default). */
export function fileKind(file: { name: string; type: string }): FileKind {
  const name = file.name.toLowerCase();
  if (name.endsWith('.md') || name.endsWith('.markdown') || file.type === 'text/markdown') {
    return 'markdown';
  }
  return 'pdf';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/document/fileType.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc --noEmit -p tsconfig.build.json`
Expected: exit 0.

```bash
git add src/document/fileType.ts src/document/fileType.test.ts
git commit -m "feat: fileKind classifier for pdf vs markdown"
```

---

## Task 2: Markdown → HTML via marked (TDD)

**Files:**
- Modify: `package.json`, `package-lock.json` (via npm)
- Create: `src/document/markdown.ts`
- Test: `src/document/markdown.test.ts`

- [ ] **Step 1: Add the marked dependency**

Run: `npm install marked`
Expected: `marked` added to `dependencies` in `package.json`; `package-lock.json` updated; `node_modules/marked` present. (marked ships its own TypeScript types — no `@types/marked` needed.)

- [ ] **Step 2: Write the failing test**

Create `src/document/markdown.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { renderMarkdownToHtml } from './markdown';

describe('renderMarkdownToHtml', () => {
  it('renders a heading', () => {
    expect(renderMarkdownToHtml('# Title')).toContain('<h1');
  });
  it('renders bold and italic', () => {
    const html = renderMarkdownToHtml('**bold** and *italic*');
    expect(html).toContain('<strong>');
    expect(html).toContain('<em>');
  });
  it('renders a bullet list', () => {
    const html = renderMarkdownToHtml('- a\n- b');
    expect(html).toContain('<ul>');
    expect((html.match(/<li>/g) ?? []).length).toBe(2);
  });
  it('preserves single line breaks as <br> (breaks: true)', () => {
    expect(renderMarkdownToHtml('line one\nline two')).toContain('<br');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/document/markdown.test.ts`
Expected: FAIL — cannot resolve `'./markdown'`.

- [ ] **Step 4: Write the implementation**

Create `src/document/markdown.ts`:

```ts
import { marked } from 'marked';

/**
 * Render markdown source to an HTML string for the teleprompter.
 * `breaks: true` keeps single line breaks (teleprompter scripts often rely on them).
 * No sanitizer — callers must confirm the file is trusted (see main.ts's load prompt).
 */
export function renderMarkdownToHtml(md: string): string {
  return marked.parse(md, { async: false, gfm: true, breaks: true }) as string;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/document/markdown.test.ts`
Expected: PASS (all four cases).

- [ ] **Step 6: Type-check and commit**

Run: `npx tsc --noEmit -p tsconfig.build.json`
Expected: exit 0.

```bash
git add package.json package-lock.json src/document/markdown.ts src/document/markdown.test.ts
git commit -m "feat: renderMarkdownToHtml via marked (line breaks preserved)"
```

---

## Task 3: DocumentView dispatch + PDF extraction split + markdown styling

**Files:**
- Create: `src/document/pdf.ts`
- Modify: `src/document/DocumentView.ts`
- Modify: `src/styles.css`

No new unit test (DOM + pdf.js/marked + `offsetTop` aren't unit-testable in jsdom); the gate is a clean type-check, the full existing suite, and the build. Verified hands-on in Task 6.

- [ ] **Step 1: Extract PDF text extraction into pdf.ts**

Create `src/document/pdf.ts` (this is the existing DocumentView extraction logic, moved out verbatim):

```ts
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { itemsToText, textToParagraphs, type RawTextItem } from './paragraphs';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

/** Extract a PDF's text, reflowed into paragraphs. */
export async function extractPdfParagraphs(file: File): Promise<string[]> {
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  let allText = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items: RawTextItem[] = content.items.map((it: any) => ({
      str: typeof it.str === 'string' ? it.str : '',
      hasEOL: !!it.hasEOL,
    }));
    allText += itemsToText(items) + '\n\n';
  }
  return textToParagraphs(allText);
}
```

- [ ] **Step 2: Rewrite DocumentView as a dispatcher + renderer**

Replace the entire contents of `src/document/DocumentView.ts` with:

```ts
import { fileKind } from './fileType';
import { extractPdfParagraphs } from './pdf';
import { renderMarkdownToHtml } from './markdown';

export class DocumentView {
  private paras: HTMLElement[] = [];

  constructor(private container: HTMLElement) {}

  /** Loads a PDF or Markdown file and renders it. Returns the rendered block count. */
  async loadFile(file: File): Promise<{ paragraphCount: number }> {
    if (fileKind(file) === 'markdown') {
      const md = await file.text();
      this.renderMarkdown(renderMarkdownToHtml(md));
    } else {
      const paragraphs = await extractPdfParagraphs(file);
      this.renderParagraphs(paragraphs);
    }
    return { paragraphCount: this.paras.length };
  }

  private renderParagraphs(paragraphs: string[]): void {
    this.container.classList.remove('md');
    this.container.innerHTML = '';
    this.paras = [];
    if (paragraphs.length === 0) {
      this.showEmpty('No selectable text found in this PDF.');
      return;
    }
    for (const text of paragraphs) {
      const el = document.createElement('p');
      el.className = 'tp-para';
      el.textContent = text;
      this.container.appendChild(el);
      this.paras.push(el);
    }
  }

  private renderMarkdown(html: string): void {
    this.container.classList.add('md');
    this.container.innerHTML = html;
    this.paras = Array.from(this.container.children) as HTMLElement[];
    if (this.container.textContent?.trim() === '') {
      this.showEmpty('No text found in this file.');
    }
  }

  private showEmpty(message: string): void {
    this.container.classList.remove('md');
    this.container.innerHTML = '';
    this.paras = [];
    const msg = document.createElement('p');
    msg.className = 'tp-empty';
    msg.textContent = message;
    this.container.appendChild(msg);
  }

  setFontSize(px: number): void {
    this.container.style.fontSize = `${px}px`;
  }

  /** offsetTop of each rendered block, for seeking. */
  paragraphOffsets(): number[] {
    return this.paras.map((p) => p.offsetTop);
  }
}
```

- [ ] **Step 3: Add markdown styling**

In `src/styles.css`, append at the end of the file:

```css

#doc.md { text-align: left; }
#doc.md h1 { font-size: 1.6em; font-weight: 700; margin: 0.4em 0; }
#doc.md h2 { font-size: 1.4em; font-weight: 700; margin: 0.4em 0; }
#doc.md h3 { font-size: 1.2em; font-weight: 700; margin: 0.4em 0; }
#doc.md h4, #doc.md h5, #doc.md h6 { font-weight: 700; margin: 0.4em 0; }
#doc.md p { margin: 0 0 0.8em; }
#doc.md ul, #doc.md ol { margin: 0 0 0.8em; padding-left: 1.5em; }
#doc.md li { margin: 0.2em 0; }
#doc.md blockquote { margin: 0 0 0.8em; padding-left: 0.8em; border-left: 4px solid #666; color: #b8c0cc; font-style: italic; }
#doc.md code { font-family: ui-monospace, monospace; font-size: 0.9em; background: rgba(255,255,255,0.1); padding: 0.1em 0.3em; border-radius: 3px; }
#doc.md pre { background: rgba(255,255,255,0.08); padding: 0.6em 0.8em; border-radius: 6px; overflow-x: auto; }
#doc.md pre code { background: none; padding: 0; }
#doc.md a { color: #7fb0ff; }
#doc.md hr { border: none; border-top: 1px solid #555; margin: 1em 0; }
#doc.md img { max-width: 100%; }

body.light #doc.md blockquote { border-left-color: #ccc; color: #555; }
body.light #doc.md code, body.light #doc.md pre { background: rgba(0,0,0,0.06); }
body.light #doc.md a { color: #1a5fb4; }
body.light #doc.md hr { border-top-color: #ccc; }
```

- [ ] **Step 4: Type-check, test, build**

Run: `npx tsc --noEmit -p tsconfig.build.json`
Expected: exit 0.

Run: `npm test`
Expected: full suite PASS (existing `paragraphs.test.ts` and the Task 1/2 tests; DocumentView has no unit test).

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/document/pdf.ts src/document/DocumentView.ts src/styles.css
git commit -m "feat: DocumentView dispatches PDF vs Markdown; render markdown formatted"
```

---

## Task 4: Wire the load path (confirm dialog + file input)

**Files:**
- Modify: `src/main.ts`
- Modify: `index.html`

- [ ] **Step 1: Import fileKind in main.ts**

In `src/main.ts`, replace:

```ts
import { DocumentView } from './document/DocumentView';
```

with:

```ts
import { DocumentView } from './document/DocumentView';
import { fileKind } from './document/fileType';
```

- [ ] **Step 2: Add the trust confirmation and generalize error text**

In `src/main.ts`, replace:

```ts
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
```

with:

```ts
async function loadFile(file: File) {
  if (loading) return;
  if (fileKind(file) === 'markdown' && !window.confirm(
    'Markdown files can contain malicious code (e.g. embedded HTML or scripts). ' +
    'Only load Markdown from a source you trust.\n\nLoad this file?'
  )) {
    return;
  }
  loading = true;
  try {
    await view.loadFile(file);
    dropZone.classList.add('hidden');
    scroller.scrollTop = 0;
    engine.stop();
  } catch (err) {
    console.error('Failed to load file:', err);
    dropZone.classList.remove('hidden');
    dropZone.textContent = 'Could not read that file. Click or drag a PDF or Markdown file.';
  } finally {
    loading = false;
  }
}
```

- [ ] **Step 3: Accept markdown in index.html**

In `index.html`, replace:

```html
    <input id="file-input" type="file" accept="application/pdf" hidden />
```

with:

```html
    <input id="file-input" type="file" accept="application/pdf,.md,.markdown,text/markdown" hidden />
```

Then replace:

```html
    <div id="drop-zone">Drag a PDF here, or click to choose a file</div>
```

with:

```html
    <div id="drop-zone">Drag a PDF or Markdown file here, or click to choose one</div>
```

- [ ] **Step 4: Type-check, test, build**

Run: `npx tsc --noEmit -p tsconfig.build.json`
Expected: exit 0.

Run: `npm test`
Expected: full suite PASS.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/main.ts index.html
git commit -m "feat: accept Markdown files with a trust-confirmation prompt"
```

---

## Task 5: Documentation

**Files:**
- Modify: `README.md`

Docs-only.

- [ ] **Step 1: Intro paragraph**

In `README.md`, replace:

```markdown
A browser-based teleprompter you drive with a Nintendo Switch **Left JoyCon**. Load a
PDF, and its text is reflowed into large, centered, vertically-scrolling copy. The
```

with:

```markdown
A browser-based teleprompter you drive with a Nintendo Switch **Left JoyCon**. Load a
PDF (reflowed into centered copy) or a Markdown file (rendered with formatting), as large,
vertically-scrolling text. The
```

Then replace:

```markdown
The PDF is parsed entirely in your browser — nothing is uploaded, and it works offline.
```

with:

```markdown
Documents are parsed entirely in your browser — nothing is uploaded, and it works offline.
```

- [ ] **Step 2: Features list**

In `README.md`, replace:

```markdown
- PDF text extraction and reflow into a clean teleprompter column
```

with:

```markdown
- PDF text extraction and reflow into a clean teleprompter column
- Markdown files rendered with formatting (headings, lists, bold/italic, blockquotes, code)
```

- [ ] **Step 3: Launch step**

In `README.md`, replace:

```markdown
1. **Load a PDF** — drag a PDF onto the window, or click to choose one.
```

with:

```markdown
1. **Load a document** — drag a PDF or Markdown file onto the window, or click to choose one.
   (Loading Markdown asks you to confirm, since a `.md` can contain embedded code.)
```

- [ ] **Step 4: Project structure**

In `README.md`, replace:

```markdown
│   ├── document/paragraphs.ts        # text extraction + seek helpers
│   ├── document/DocumentView.ts      # PDF.js load + reflow + font size
```

with:

```markdown
│   ├── document/DocumentView.ts      # dispatch by file type + render + font size
│   ├── document/pdf.ts               # PDF.js text extraction → paragraphs
│   ├── document/markdown.ts          # Markdown → HTML (marked)
│   ├── document/fileType.ts          # classify pdf vs markdown
│   ├── document/paragraphs.ts        # reflow + seek helpers
```

- [ ] **Step 5: Tech line**

In `README.md`, replace:

```markdown
TypeScript · Vite · Vitest · [PDF.js](https://mozilla.github.io/pdf.js/) · [WebHID](https://developer.mozilla.org/en-US/docs/Web/API/WebHID_API). No UI
```

with:

```markdown
TypeScript · Vite · Vitest · [PDF.js](https://mozilla.github.io/pdf.js/) · [marked](https://marked.js.org/) · [WebHID](https://developer.mozilla.org/en-US/docs/Web/API/WebHID_API). No UI
```

- [ ] **Step 6: Verify and commit**

Run: `npm test`
Expected: full suite PASS (docs-only; nothing breaks).

```bash
git add README.md
git commit -m "docs: document Markdown file support"
```

---

## Task 6: In-browser verification (manual — human in the loop)

**Cannot be fully automated** (renders in a real browser; the `window.confirm` dialog needs a click). The controller should pause here and run it with the user. No JoyCon required.

- [ ] **Step 1: Create a sample markdown file**

Create `/tmp/sample.md` with headings, **bold**, *italic*, a bullet list, a numbered list, a `> blockquote`, `inline code`, a fenced code block, a [link](https://example.com), and a couple of intentional single line breaks.

- [ ] **Step 2: Launch and load**

Run `npm run dev`, open the printed URL, and load `sample.md` (drag or click-choose). Confirm:
- The **trust-confirmation dialog** appears; clicking Cancel does NOT load; clicking OK loads.
- The document renders **left-aligned with formatting** (heading sizes, bold/italic, indented lists, blockquote bar, code styling, link color).
- **Single line breaks are preserved** (a `<br>` shows where you put a lone newline).

- [ ] **Step 3: Verify scroll/seek/theme**

- Scroll works (stick or ↑/↓); D-pad seek (`j`/`l`) jumps between blocks.
- Click the HUD **Theme** item — markdown stays legible in light mode (blockquote/code/link colors adapt).
- Load a PDF afterward — it still renders centered (no `md` class leakage, no confirm prompt).

- [ ] **Step 4: Report**

Report what rendered correctly and anything off. No commit unless a fix is needed.

---

## Notes

- **ScrollEngine / ControlMapper / the seek logic are untouched.** `paragraphOffsets()` now reads whatever block elements `this.paras` holds (PDF `<p>`s or markdown blocks), in the same `#scroller` coordinate space, so seek works for both.
- **PDF path is behaviorally unchanged** — the extraction code moved to `pdf.ts` verbatim; `renderParagraphs` matches the old `render`.
- **Security:** markdown is rendered without a sanitizer; the `window.confirm` trust prompt (markdown-only) is the mitigation, per the spec.
- **`.DS_Store`** may be present untracked; never stage it — use the explicit `git add` lists above.
