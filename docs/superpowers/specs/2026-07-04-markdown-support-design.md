# Markdown File Support

## Problem

The teleprompter only loads PDFs (pdf.js text extraction → reflowed centered paragraphs).
The user wants to also load Markdown (`.md`) files and keep their formatting (headings,
bold/italic, lists, blockquotes, code, links), rendered as a left-aligned document.

## Goal

Load a `.md` file, parse it with the `marked` library (preserving line breaks), and render
it with formatting as a left-aligned document that scrolls and seeks like the PDF view. PDF
handling is unchanged. Before loading a Markdown file, warn the user that it can contain
malicious code.

## Design

### File-type routing

`DocumentView.loadFile(file)` dispatches on the file kind:
- **markdown** (`.md` / `.markdown` extension, or `text/markdown` MIME) → read text, parse to
  HTML, render formatted.
- **anything else** → the existing PDF extraction path (unchanged).

A pure `fileKind(file)` helper makes the decision and is shared by `main.ts` (for the
confirmation dialog) and `DocumentView` (for routing).

### Modules (decomposition)

`DocumentView` currently mixes pdf.js extraction with rendering; since it is gaining a second
source, split into focused units:

- **`src/document/fileType.ts`** — `type FileKind = 'pdf' | 'markdown'`;
  `fileKind(file: { name: string; type: string }): FileKind`. Returns `'markdown'` for a
  `.md`/`.markdown` name or `text/markdown` type; `'pdf'` otherwise (preserving today's
  default). Pure, unit-tested.
- **`src/document/pdf.ts`** — `extractPdfParagraphs(file: File): Promise<string[]>`: the
  existing pdf.js extraction (worker setup, per-page `getTextContent`, `itemsToText` +
  `textToParagraphs`), moved out verbatim.
- **`src/document/markdown.ts`** — `renderMarkdownToHtml(md: string): string`: a thin `marked`
  wrapper, `marked.parse(md, { async: false, gfm: true, breaks: true }) as string`.
  `breaks: true` preserves single line breaks as `<br>` (consistent with the PDF line-break
  behavior). No sanitizer (see Security).
- **`src/document/DocumentView.ts`** — dispatcher + renderer:
  - `loadFile`: `fileKind` → `extractPdfParagraphs` + `renderParagraphs`, or
    `renderMarkdownToHtml(await file.text())` + `renderMarkdown`. Returns
    `{ paragraphCount: this.paras.length }`.
  - `renderParagraphs(string[])`: unchanged behavior — removes the `md` class, builds
    `<p class="tp-para">` per paragraph, empty → "No selectable text found in this PDF."
  - `renderMarkdown(html)`: adds the `md` class to the container, sets `innerHTML = html`,
    sets `this.paras = Array.from(container.children)`; if there is no text, shows a
    "No text found in this file." message.
  - `setFontSize` and `paragraphOffsets` unchanged.

### Seeking

`paragraphOffsets()` stays `this.paras.map(p => p.offsetTop)`. For markdown, `this.paras` is
the block-level children of `#doc` (headings, paragraphs, lists, blockquotes, …), whose
`offsetParent` is `#scroller` — the same coordinate space PDF paragraphs use — so D-pad seek
jumps between blocks with no change to the seek logic.

### Layout & styling

Markdown renders left-aligned, scoped under `#doc.md` so PDF rendering is untouched:
`#doc.md { text-align: left; }` plus styles for `h1`–`h6`, `p`, `ul`/`ol`/`li`, `blockquote`,
`code`, `pre`, `a`, `hr`, `img` (relative `em` sizes so the font-size control still scales
everything). `body.light #doc.md …` overrides keep blockquote/code/link/hr colors legible in
light mode. The reading column stays centered on screen (`#doc` keeps `max-width`/`margin`);
only the content flows left.

### Security — confirmation dialog

`marked` does not sanitize, so a `.md` can carry embedded HTML/scripts. Before loading a
markdown file, `main.ts` shows a blocking `window.confirm(...)` warning that Markdown files
can contain malicious code and to only load documents from a trusted source. If the user
declines, the file is not loaded (drop zone stays). The dialog fires only for markdown
(`fileKind(file) === 'markdown'`), not for PDFs.

### Wiring

- **index.html** — file-input `accept="application/pdf,.md,.markdown,text/markdown"`;
  drop-zone text → "Drag a PDF or Markdown file here, or click to choose one".
- **main.ts** — import `fileKind`; in `loadFile`, after the `loading` guard, if the file is
  markdown, run the confirm dialog and return early if declined; generalize the error text
  from "PDF" to "file".
- **package.json** — add `marked` to dependencies (`npm install marked`; marked ships its own
  types, no `@types` needed).

### Testing

- `fileType.test.ts` — `fileKind` cases: `.md`/`.markdown` names and `text/markdown` type →
  `'markdown'`; `.pdf` name / `application/pdf` / unknown → `'pdf'`.
- `markdown.test.ts` — `renderMarkdownToHtml` smoke tests: `# Title` → contains `<h1`;
  `**b**` → `<strong>`; `- a\n- b` → `<ul>` with two `<li>`; `a\nb` → contains `<br` (proves
  `breaks: true`).
- `DocumentView` (DOM + pdf.js/marked/`offsetTop`) and the `main.ts` confirm wiring are
  verified hands-on, as the existing rendering code is. Existing `paragraphs.test.ts` is
  unaffected.

## Out of scope

- Sanitizing markdown HTML (handled by the trust-confirmation dialog instead of a sanitizer).
- GitHub-flavored extras beyond marked's `gfm` defaults (e.g. no custom table styling work).
- Remembering the confirmation choice across loads (it prompts each time a `.md` is loaded).
- Non-`.md` text formats (`.txt`, `.docx`, etc.).
