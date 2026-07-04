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
