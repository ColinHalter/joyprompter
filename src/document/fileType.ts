export type FileKind = 'pdf' | 'markdown';

/** Classify a file as markdown (.md/.markdown or text/markdown) or pdf (the default). */
export function fileKind(file: { name: string; type: string }): FileKind {
  const name = file.name.toLowerCase();
  if (name.endsWith('.md') || name.endsWith('.markdown') || file.type === 'text/markdown') {
    return 'markdown';
  }
  return 'pdf';
}
