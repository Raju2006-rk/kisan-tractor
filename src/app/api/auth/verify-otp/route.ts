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
import { enforceRateLimit } from "@/lib/rate-limit";
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
    const otp =
      typeof body.otp === "string" ? body.otp.replace(/\D/g, "").slice(0, 6) : "";
    const providedName =
      typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
    if (!isValidMobile(mobile)) {
      return jsonError("Please enter a valid 10-digit mobile number.", 400);
    }
    if (otp.length !== 6) {
      return jsonError("Enter the 6-digit sign-in OTP.", 400);
    }

    // Bound OTP guessing per IP and per phone number.
    const ipLimited = enforceRateLimit(request, "otp-verify-ip", 20, 10 * 60 * 1000);
    if (ipLimited) return ipLimited;
    const mobileLimited = enforceRateLimit(
      request,
      "otp-verify-mobile",
      8,
      10 * 60 * 1000,
      mobile,
    );
    if (mobileLimited) return mobileLimited;

    let supabaseUserId: string | undefined;
    const challengeVerified = await verifyOtpChallenge(mobile, otp);
    if (challengeVerified.ok) {
      // Test OTP matched successfully
    } else if (isSupabaseAuthConfigured()) {
      const verified = await verifySupabaseOtp(mobile, otp);
      if ("error" in verified) {
        return jsonError(verified.error, 400);
      }
      supabaseUserId = verified.supabaseUserId;
    } else {
      return jsonError(challengeVerified.reason ?? "Could not verify this OTP.", 400);
    }

    const db = await getDb();
    const existing = db.users.find((u) => u.mobile === mobile);

    const identity = await validateStoredIdentity(mobile, providedName);
    if (!identity.ok) {
      return NextResponse.json(
        { error: identity.reason, code: "identity_mismatch" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const role: Role = existing?.role ?? (body.role === "owner" ? "owner" : "farmer");
    const { user, isNew } = await findOrCreateUser({
      id: supabaseUserId,
      mobile,
      name: providedName || undefined,
      role,
      language: body.language ?? "en",
    });

    await createSession(user.id);
    await rememberDevice(user);

    const fresh = await getDb();
    const farmerProf = fresh.farmerProfiles.find((p) => p.userId === user.id);
    const ownerProf = fresh.ownerProfiles.find((p) => p.userId === user.id);
    const profile = user.role === "owner" ? ownerProf : farmerProf;
    const hasTractor = fresh.tractors.some((t) => t.ownerId === user.id);
    const hasFarmerDetails = Boolean(
      farmerProf &&
      farmerProf.village &&
      farmerProf.village !== "Demo Village" &&
      user.name &&
      user.name.trim().length >= 2,
    );

    return NextResponse.json({
      ok: true,
      signedIn: true,
      isNew,
      role: user.role,
      hasTractor,
      hasFarmerDetails,
      user: { ...user, profile },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
