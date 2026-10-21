import { NextRequest, NextResponse } from "next/server";
import { loadReconciliation, syncAuditFindings } from "@/lib/housekeeping-audit";

/**
 * Daily snapshot of the audit findings (see vercel.json), so a finding is saved even when nobody opens the
 * audit page before the bookings are edited. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; the proxy
 * lets /api/cron through without a login, so this check is the only gate — with no secret set it refuses everything.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { recon, nights } = await loadReconciliation(14);
  await syncAuditFindings(recon, nights);
  return NextResponse.json({ ok: true });
}
