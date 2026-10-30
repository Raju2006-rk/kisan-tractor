import { NextResponse } from "next/server";
import {
  createOtpChallenge,
  isValidMobile,
  normalizeMobile,
} from "@/lib/auth";
import { getDb } from "@/lib/db";
import { handleApiError, jsonError, readJson } from "@/lib/http";
import type { Language, Role } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await readJson<{
      mobile?: string;
      role?: Role;
      language?: Language;
    }>(request);
    const mobile = normalizeMobile(body.mobile ?? "");
    if (!isValidMobile(mobile)) {
      return jsonError("Please enter a valid 10-digit Indian mobile number.", 400);
    }
    const db = await getDb();
    const existing = db.users.find((u) => u.mobile === mobile);
    const role: Role | null = existing?.role ?? body.role ?? null;
    if (!existing && !role) {
      return jsonError("Please choose whether you are a farmer or tractor owner.", 400);
    }
    const challenge = await createOtpChallenge(mobile, role);
    return NextResponse.json({
      ok: true,
      mobile,
      demoOtp: challenge.otp,
      expiresAt: challenge.expiresAt,
      isExisting: Boolean(existing),
      role,
      name: existing?.name ?? null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
