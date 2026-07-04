import { fileKind } from './fileType';
import { extractPdfParagraphs } from './pdf';
import { renderMarkdownToHtml } from './markdown';
import { splitHardBreakLines } from './lineSplit';
import { decorateInline } from './decorateInline';

/** Markdown elements that act as seek stops: headings, paragraphs, bullets, quotes, rows, and split lines. */
const MD_SEEK_SELECTOR = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,tr,hr,.tp-line';

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
    decorateInline(this.container);
    splitHardBreakLines(this.container);
    this.paras = Array.from(this.container.querySelectorAll(MD_SEEK_SELECTOR)) as HTMLElement[];
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

  /** Sorted, de-duplicated offsetTop of each seek stop (blocks/bullets/lines share y for nested matches). */
  paragraphOffsets(): number[] {
    const tops = this.paras.map((p) => p.offsetTop);
    return Array.from(new Set(tops)).sort((a, b) => a - b);
  }
}
