import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { itemsToText, textToParagraphs, type RawTextItem } from './paragraphs';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export class DocumentView {
  private paras: HTMLElement[] = [];

  constructor(private container: HTMLElement) {}

  /** Loads a PDF file, extracts+reflows text. Returns the paragraph count. */
  async loadFile(file: File): Promise<{ paragraphCount: number }> {
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
    const paragraphs = textToParagraphs(allText);
    this.render(paragraphs);
    return { paragraphCount: paragraphs.length };
  }

  private render(paragraphs: string[]): void {
    this.container.innerHTML = '';
    this.paras = [];
    if (paragraphs.length === 0) {
      const msg = document.createElement('p');
      msg.className = 'tp-empty';
      msg.textContent = 'No selectable text found in this PDF.';
      this.container.appendChild(msg);
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

  setFontSize(px: number): void {
    this.container.style.fontSize = `${px}px`;
  }

  /** offsetTop of each paragraph, for seeking. */
  paragraphOffsets(): number[] {
    return this.paras.map((p) => p.offsetTop);
  }
}
