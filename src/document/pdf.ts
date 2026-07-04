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
