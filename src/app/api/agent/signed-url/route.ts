/**
 * GET /api/agent/signed-url
 *
 * Mints a short-lived signed WebSocket URL for the Clarion ElevenLabs Convai agent
 * so the browser can open a voice conversation WITHOUT ever seeing ELEVENLABS_API_KEY.
 * The agent is Claude-backed and grounded per-conversation via dynamic variables the
 * client passes at session start (see VoiceAgent.tsx).
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const key = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;

  if (!key || !agentId) {
    return NextResponse.json(
      { ok: false, error: "Voice agent is not configured (missing ELEVENLABS_API_KEY or ELEVENLABS_AGENT_ID)." },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
      { headers: { "xi-api-key": key } }
    );
    if (!res.ok) {
      const body = await res.text();
      console.error("[/api/agent/signed-url] ElevenLabs error", res.status, body.slice(0, 200));
      return NextResponse.json(
        { ok: false, error: "Could not start the voice agent right now. Please try again." },
        { status: 502 }
      );
    }
    const data = (await res.json()) as { signed_url?: string; signedUrl?: string };
    const signedUrl = data.signed_url ?? data.signedUrl;
    if (!signedUrl) {
      return NextResponse.json({ ok: false, error: "No signed URL returned." }, { status: 502 });
    }
    return NextResponse.json({ ok: true, signedUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/agent/signed-url]", message);
    return NextResponse.json({ ok: false, error: "Voice agent unavailable." }, { status: 500 });
  }
}
