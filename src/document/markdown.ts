import { marked } from 'marked';

/**
 * Render markdown source to an HTML string for the teleprompter.
 * `breaks: true` keeps single line breaks (teleprompter scripts often rely on them).
 * No sanitizer — callers must confirm the file is trusted (see main.ts's load prompt).
 */
export function renderMarkdownToHtml(md: string): string {
  return marked.parse(md, { async: false, gfm: true, breaks: true }) as string;
}
