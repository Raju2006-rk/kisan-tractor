import { NextResponse } from "next/server";
import {
  createSession,
  findOrCreateUser,
  isValidMobile,
  normalizeMobile,
  rememberDevice,
  validateStoredIdentity,
  verifyOtpChallenge,
  verifySupabaseOtp,
} from "@/lib/auth";
import { getDb } from "@/lib/db";
import { handleApiError, jsonError, readJson } from "@/lib/http";
import { isSupabaseAuthConfigured } from "@/lib/supabase";
import type { Language, Role } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await readJson<{
      mobile?: string;
      otp?: string;
      name?: string;
      role?: Role;
      language?: Language;
    }>(request);
    const mobile = normalizeMobile(body.mobile ?? "");
    const otp = (body.otp ?? "").replace(/\D/g, "");
    if (!isValidMobile(mobile)) {
      return jsonError("Please enter a valid 10-digit mobile number.", 400);
    }
    if (otp.length !== 6) {
      return jsonError("Enter the 6-digit sign-in OTP.", 400);
    }

    let supabaseUserId: string | undefined;
    if (isSupabaseAuthConfigured()) {
      const verified = await verifySupabaseOtp(mobile, otp);
      if ("error" in verified) {
        const fallback = await verifyOtpChallenge(mobile, otp);
        if (!fallback.ok) {
          return jsonError(verified.error, 400);
        }
      } else {
        supabaseUserId = verified.supabaseUserId;
      }
    } else {
      const verified = await verifyOtpChallenge(mobile, otp);
      if (!verified.ok) {
        return jsonError(verified.reason ?? "Could not verify this OTP.", 400);
      }
    }

    const db = await getDb();
    const existing = db.users.find((u) => u.mobile === mobile);

    const identity = await validateStoredIdentity(mobile, body.name);
    if (!identity.ok) {
      return NextResponse.json(
        { error: identity.reason, code: "identity_mismatch" },
        { status: 400 },
      );
    }

    const role: Role = existing?.role ?? (body.role === "owner" ? "owner" : "farmer");
    const { user, isNew } = await findOrCreateUser({
      id: supabaseUserId,
      mobile,
      name: body.name,
      role,
      language: body.language ?? "en",
    });

    await createSession(user.id);
    await rememberDevice(user);

    const fresh = await getDb();
    const profile =
      fresh.farmerProfiles.find((p) => p.userId === user.id) ??
      fresh.ownerProfiles.find((p) => p.userId === user.id);

    return NextResponse.json({
      ok: true,
      signedIn: true,
      isNew,
      user: { ...user, profile },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
