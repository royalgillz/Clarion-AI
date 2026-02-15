/**
 * src/lib/ocr.ts
 *
 * Tesseract.js OCR for PDF pages (offline, local processing).
 */

import { fromBuffer } from "pdf2pic";
import { createWorker } from "tesseract.js";

export class OcrError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const DEFAULT_LANG = process.env.TESSERACT_LANG || "eng";
type TesseractWorker = Awaited<ReturnType<typeof createWorker>>;

async function withWorker<T>(fn: (worker: TesseractWorker) => Promise<T>) {
  const worker = await createWorker(DEFAULT_LANG);
  try {
    return await fn(worker);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    throw new OcrError("OCR_INIT_FAILED", message);
  } finally {
    await worker.terminate();
  }
}

export async function ocrImageBuffer(buffer: Buffer) {
  return withWorker(async (worker) => {
    try {
      const { data } = await worker.recognize(buffer);
      const text = data?.text ?? "";
      const cleaned = text.trim();
      if (!cleaned) throw new OcrError("OCR_EMPTY", "OCR returned no text.");
      return cleaned;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      throw new OcrError("OCR_FAILED", message);
    }
  });
}

export type ProgressCallback = (current: number, total: number, text: string) => void;

export async function ocrPdfBuffer(
  buffer: Buffer,
  pageCount: number,
  onProgress?: ProgressCallback
) {
  const converter = fromBuffer(buffer, {
    density: 160,
    format: "png",
    width: 1600,
    height: 2200,
  });

  const texts: string[] = [];
  const pages = Math.max(1, Math.min(pageCount, 50));

  return withWorker(async (worker) => {
    try {
      for (let page = 1; page <= pages; page++) {
        const pageResult = await converter(page, { responseType: "buffer" });
        const imgBuffer = pageResult?.buffer as Buffer | undefined;

        if (!imgBuffer || !Buffer.isBuffer(imgBuffer)) {
          throw new OcrError("OCR_PAGE_RENDER_FAILED", `Failed to render page ${page}`);
        }

        const { data } = await worker.recognize(imgBuffer);
        const pageText = data?.text ?? "";
        texts.push(pageText.trim());
        
        // Report progress after each page
        if (onProgress) {
          const soFar = texts.filter(Boolean).join("\n\n");
          onProgress(page, pages, soFar);
        }
      }

      const merged = texts.filter(Boolean).join("\n\n");
      if (!merged) {
        throw new OcrError("OCR_EMPTY", "OCR returned no text.");
      }

      return merged;
    } catch (err: unknown) {
      if (err instanceof OcrError) throw err;
      const message = err instanceof Error ? err.message : "Unknown error";
      throw new OcrError("OCR_FAILED", message);
    }
  });
}
