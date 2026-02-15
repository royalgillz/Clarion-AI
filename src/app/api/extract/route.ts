/**
 * src/app/api/extract/route.ts
 *
 * POST /api/extract
 * Accepts: multipart/form-data  { file: <PDF binary> }
 * Returns: { ok: true, extractedText: string, source: "pdf" | "ocr" }
 *
 * Uses the Node.js runtime (required by pdf-parse which uses `fs`).
 */

import { NextRequest, NextResponse } from "next/server";
// pdf-parse has no ESM export; use require via dynamic import workaround
import pdfParse from "pdf-parse";
import { ocrPdfBuffer, OcrError } from "@/lib/ocr";

// Force Node runtime – NOT Edge (pdf-parse needs fs + Buffer)
export const runtime = "nodejs";

// Helper to create Server-Sent Events stream
function createSSEStream(
  onStart: (send: (data: unknown) => void) => Promise<void>
) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };
      
      try {
        await onStart(send);
        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        send({ type: "error", error: message });
        controller.close();
      }
    },
  });
  
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

export async function POST(req: NextRequest) {
  // Check if client wants streaming progress (via query param)
  const url = new URL(req.url);
  const stream = url.searchParams.get("stream") === "true";
  
  if (stream) {
    return handleStreamingExtract(req);
  }
  
  try {
    // ── 1. Parse multipart form ──────────────────────────────────────────────
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        {
          ok: false,
          error: "NO_FILE",
          message: "No PDF file uploaded. Send field name: 'file'.",
        },
        { status: 400 }
      );
    }

    const fileObj = file as File;
    if (fileObj.type !== "application/pdf") {
      return NextResponse.json(
        {
          ok: false,
          error: "UNSUPPORTED_MEDIA_TYPE",
          message: `Expected application/pdf, got ${fileObj.type}`,
        },
        { status: 415 }
      );
    }

    // ── 2. Convert File → Buffer ─────────────────────────────────────────────
    const arrayBuffer = await fileObj.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // ── 3. Extract text via pdf-parse ────────────────────────────────────────
    // Fallback logic diagram:
    // PDF -> pdf-parse -> if fails OR text < 100 chars => OCR each page -> merge -> return
    let parsed;
    let looksScanned = false;
    let text = "";
    
    try {
      parsed = await pdfParse(buffer, {
        // Limit to 50 pages for demo sanity
        max: 50,
      });

      const rawText = parsed.text ?? "";
      text = rawText.trim();
      const nonWhitespace = rawText.replace(/\s+/g, "");
      const whitespaceChars = rawText.replace(/\S/g, "").length;
      const whitespaceRatio = rawText.length ? whitespaceChars / rawText.length : 1;

      looksScanned = !text || nonWhitespace.length < 100 || whitespaceRatio > 0.9;
    } catch (pdfParseError) {
      // pdf-parse failed (e.g., bad XRef entry) - fall back to OCR
      console.log("[/api/extract] pdf-parse failed, falling back to OCR:", pdfParseError);
      looksScanned = true;
      parsed = { numpages: 1 }; // Default to 1 page for OCR
    }

    if (looksScanned) {
      try {
        const ocrText = await ocrPdfBuffer(buffer, parsed.numpages || 1);
        return NextResponse.json({
          ok: true,
          extractedText: ocrText,
          source: "ocr",
        });
      } catch (err: unknown) {
        if (err instanceof OcrError) {
          return NextResponse.json(
            { ok: false, error: err.code, message: err.message },
            { status: 502 }
          );
        }
        const message = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json(
          { ok: false, error: "OCR_FAILED", message },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      extractedText: text,
      source: "pdf",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/extract]", message);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", message },
      { status: 500 }
    );
  }
}

// Streaming version of extract that sends progress updates
async function handleStreamingExtract(req: NextRequest) {
  return createSSEStream(async (send) => {
    try {
      // ── 1. Parse multipart form ──────────────────────────────────────────────
      const formData = await req.formData();
      const file = formData.get("file");

      if (!file || typeof file === "string") {
        send({ type: "error", error: "NO_FILE", message: "No PDF file uploaded" });
        return;
      }

      const fileObj = file as File;
      if (fileObj.type !== "application/pdf") {
        send({ 
          type: "error", 
          error: "UNSUPPORTED_MEDIA_TYPE", 
          message: `Expected application/pdf, got ${fileObj.type}` 
        });
        return;
      }

      send({ type: "status", message: "Converting PDF to buffer..." });

      // ── 2. Convert File → Buffer ─────────────────────────────────────────────
      const arrayBuffer = await fileObj.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      send({ type: "status", message: "Attempting text extraction..." });

      // ── 3. Extract text via pdf-parse ────────────────────────────────────────
      let parsed;
      let looksScanned = false;
      let text = "";
      
      try {
        parsed = await pdfParse(buffer, { max: 50 });
        const rawText = parsed.text ?? "";
        text = rawText.trim();
        const nonWhitespace = rawText.replace(/\s+/g, "");
        const whitespaceChars = rawText.replace(/\S/g, "").length;
        const whitespaceRatio = rawText.length ? whitespaceChars / rawText.length : 1;

        looksScanned = !text || nonWhitespace.length < 100 || whitespaceRatio > 0.9;
        
        if (!looksScanned) {
          send({ 
            type: "status", 
            message: `Extracted ${text.length} characters via PDF parser` 
          });
        }
      } catch (pdfParseError) {
        send({ type: "status", message: "PDF parser failed, switching to OCR..." });
        looksScanned = true;
        parsed = { numpages: 1 };
      }

      if (looksScanned) {
        const numPages = parsed.numpages || 1;
        send({ 
          type: "status", 
          message: `Starting OCR for ${numPages} page${numPages > 1 ? 's' : ''}...` 
        });

        try {
          const ocrText = await ocrPdfBuffer(
            buffer, 
            numPages,
            (current, total, textSoFar) => {
              // Send progress update for each page
              send({
                type: "progress",
                current,
                total,
                message: `Processing page ${current} of ${total}...`,
                textLength: textSoFar.length,
              });
            }
          );
          
          send({ 
            type: "complete", 
            extractedText: ocrText, 
            source: "ocr",
            textLength: ocrText.length,
          });
        } catch (err: unknown) {
          if (err instanceof OcrError) {
            send({ type: "error", error: err.code, message: err.message });
          } else {
            const message = err instanceof Error ? err.message : "Unknown error";
            send({ type: "error", error: "OCR_FAILED", message });
          }
        }
      } else {
        send({ 
          type: "complete", 
          extractedText: text, 
          source: "pdf",
          textLength: text.length,
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      send({ type: "error", error: "SERVER_ERROR", message });
    }
  });
}
