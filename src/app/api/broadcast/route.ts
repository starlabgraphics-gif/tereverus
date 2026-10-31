import { NextResponse } from "next/server";
import { isAuthedAdmin } from "@/lib/auth";
import {
  advanceIfCurrent,
  getPublicState,
  nextEntryIdAfter,
  reconcileCurrent,
  setBroadcast,
} from "@/lib/broadcast";
import { ensureSchema } from "@/lib/dbReady";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSchema();
  await reconcileCurrent();
  const state = await getPublicState();
  return NextResponse.json(state);
}

export async function POST(req: Request) {
  await ensureSchema();
  let body: {
    action?: string;
    entryId?: string;
    at?: string; // ISO for schedule
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const action = body.action;

  // ── Public: a viewer reports the current item ended / failed.
  // Advances the channel only when it matches what is truly current
  // (keeps a single source of truth for every connected viewer). ──
  if (action === "ended" || action === "failed") {
    if (!body.entryId) {
      return NextResponse.json({ error: "entryId required." }, { status: 400 });
    }
    const res = await advanceIfCurrent(body.entryId);
    return NextResponse.json(res);
  }

  // ── Everything below is control-room only ──
  if (!(await isAuthedAdmin())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const state0 = await getPublicState();

  if (action === "go_live") {
    if (state0.entries.length === 0) {
      return NextResponse.json(
        { error: "Add at least one program to the schedule first." },
        { status: 409 },
      );
    }
    const target = body.entryId ?? state0.entries[0]?.id ?? null;
    await setBroadcast({ status: "live", currentEntryId: target, scheduledAt: null });
  } else if (action === "pause") {
    await setBroadcast({ status: "paused" });
  } else if (action === "resume") {
    const current = (await reconcileCurrent()) ?? (await getPublicState()).currentEntryId;
    await setBroadcast({ status: "live", currentEntryId: current });
  } else if (action === "skip") {
    const current = (await getPublicState()).currentEntryId;
    const next = await nextEntryIdAfter(current);
    if (next === null) {
      return NextResponse.json({ error: "Nothing to skip to." }, { status: 409 });
    }
    await setBroadcast({ currentEntryId: next });
  } else if (action === "set_entry") {
    if (!body.entryId) {
      return NextResponse.json({ error: "entryId required." }, { status: 400 });
    }
    await setBroadcast({ currentEntryId: body.entryId });
  } else if (action === "schedule") {
    if (!body.at) {
      return NextResponse.json({ error: "at required." }, { status: 400 });
    }
    const at = new Date(body.at);
    if (Number.isNaN(at.getTime())) {
      return NextResponse.json({ error: "Invalid time." }, { status: 400 });
    }
    if (state0.entries.length === 0) {
      return NextResponse.json(
        { error: "Add at least one program to the schedule first." },
        { status: 409 },
      );
    }
    const target = body.entryId ?? state0.entries[0]?.id ?? null;
    await setBroadcast({ status: "scheduled", scheduledAt: at, currentEntryId: target });
  } else if (action === "cancel") {
    await setBroadcast({ status: "idle", scheduledAt: null });
  } else if (action === "offline") {
    await setBroadcast({ status: "idle", scheduledAt: null });
  } else {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const state = await getPublicState();
  return NextResponse.json({ ok: true, state });
}
