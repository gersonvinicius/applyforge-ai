import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/build/pdf.mjs';

GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PdfTextLine {
  y: number;
  parts: string[];
}

function normalizeLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export async function extractPdfText(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const document = await getDocument({
    data: bytes,
    useWorkerFetch: false,
    isEvalSupported: false
  }).promise;

  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines: PdfTextLine[] = [];

    for (const item of content.items as Array<{ str?: string; transform?: number[] }>) {
      const text = normalizeLine(String(item.str ?? ''));

      if (text === '') {
        continue;
      }

      const y = Array.isArray(item.transform) ? item.transform[5] ?? 0 : 0;
      const current = lines.at(-1);

      if (current && Math.abs(current.y - y) <= 2.5) {
        current.parts.push(text);
      } else {
        lines.push({ y, parts: [text] });
      }
    }

    const pageText = lines
      .map((line) => normalizeLine(line.parts.join(' ')))
      .filter(Boolean)
      .join('\n');

    if (pageText !== '') {
      pages.push(pageText);
    }
  }

  return pages.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}
