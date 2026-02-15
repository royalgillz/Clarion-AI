/**
 * src/app/api/ocr/route.ts
 *
 * POST /api/ocr
 * Accepts: multipart/form-data  { file: <PDF binary> }
 * Returns: { ok: false, error: "OCR_NOT_IMPLEMENTED", message: string }
 *
 * Hackathon stub: plug in OCR (Tesseract, cloud OCR, etc.) here.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
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

    return NextResponse.json(
      {
        ok: false,
        error: "OCR_NOT_IMPLEMENTED",
        message: "OCR is not wired yet. This is the placeholder for a Tesseract.js pipeline.",
      },
      { status: 501 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/ocr]", message);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", message },
      { status: 500 }
    );
  }
}
