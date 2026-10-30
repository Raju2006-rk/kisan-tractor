import { NextResponse } from "next/server";
import { resetDemoDatabase } from "@/lib/db";
import { handleApiError, jsonError } from "@/lib/http";

export async function POST() {
  try {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_RESET !== "true") {
      return jsonError("Demo reset is disabled.", 403);
    }
    await resetDemoDatabase();
    return NextResponse.json({ ok: true, message: "Demo data restored." });
  } catch (error) {
    return handleApiError(error);
  }
}
