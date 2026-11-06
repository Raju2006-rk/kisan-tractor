import { NextResponse } from "next/server";
import {
  checkFarmerRegistered,
  createOtpChallenge,
  createSession,
  isDevOtpEnabledFor,
  isTrustedDevice,
  isValidMobile,
  normalizeMobile,
  rememberDevice,
  sendSupabaseOtp,
  validateStoredIdentity,
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
      name?: string;
      role?: Role;
      language?: Language;
    }>(request);
    const mobile = normalizeMobile(body.mobile ?? "");
    if (!isValidMobile(mobile)) {
      return jsonError("Please enter a valid 10-digit Indian mobile number.", 400);
    }
    const providedName = (body.name ?? "").trim().slice(0, 80);

    // Throttle per IP and per phone number so OTP sending cannot be used to
    // spam a farmer or to enumerate accounts quickly.
    const ipLimited = enforceRateLimit(request, "otp-request-ip", 10, 10 * 60 * 1000);
    if (ipLimited) return ipLimited;
    const mobileLimited = enforceRateLimit(
      request,
      "otp-request-mobile",
      3,
      10 * 60 * 1000,
      mobile,
    );
    if (mobileLimited) return mobileLimited;

    const db = await getDb();
    const existing = db.users.find((u) => u.mobile === mobile);
    const role: Role | null =
      existing?.role ??
      (body.role === "owner" ? "owner" : body.role === "farmer" ? "farmer" : null);
    if (!existing && !role) {
      return jsonError("Please choose whether you are a farmer or tractor owner.", 400);
    }

    // 1. Farmer Second-Time Login Flow:
    // If farmer has already registered their data in storage (database/Supabase), directly log in to dashboard without asking for details.
    const farmerCheck = checkFarmerRegistered(db, mobile);
    if (farmerCheck.isRegistered && farmerCheck.user) {
      await createSession(farmerCheck.user.id);
      await rememberDevice(farmerCheck.user);
      return NextResponse.json({
        ok: true,
        signedIn: true,
        isNew: false,
        mobile,
        role: "farmer",
        name: farmerCheck.user.name,
      });
    }

    // 2. Tractor Owner Subsequent Login Flow:
    // When a registered tractor owner enters their mobile and name, if their details and tractor exist in storage,
    // directly redirect to owner dashboard.
    if (existing && existing.role === "owner") {
      const hasTractor = db.tractors.some((t) => t.ownerId === existing.id);
      const cleanProvided = providedName.toLowerCase().trim();
      const cleanStored = existing.name.toLowerCase().trim();
      const ownerNameMatches = Boolean(
        cleanProvided &&
        (cleanStored === cleanProvided ||
          cleanStored.includes(cleanProvided) ||
          cleanProvided.includes(cleanStored)),
      );

      if (hasTractor && ownerNameMatches) {
        await createSession(existing.id);
        await rememberDevice(existing);
        return NextResponse.json({
          ok: true,
          signedIn: true,
          isNew: false,
          mobile,
          role: "owner",
          hasTractor: true,
          name: existing.name,
        });
      }
    }

    // A returning user must still type the name saved for this mobile number if providing name.
    const identity = await validateStoredIdentity(mobile, providedName);
    if (!identity.ok) {
      return NextResponse.json(
        { error: identity.reason, code: "identity_mismatch" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    // A browser that already completed an OTP on this trusted device
    if (existing && (await isTrustedDevice(existing.id, mobile))) {
      await createSession(existing.id);
      await rememberDevice(existing);
      const hasTractor = db.tractors.some((t) => t.ownerId === existing.id);
      const { otp, expiresAt } = await createOtpChallenge(mobile, existing.role);
      return NextResponse.json({
        ok: true,
        signedIn: true,
        isNew: false,
        mobile,
        role: existing.role,
        hasTractor,
        name: existing.name,
        devOtp: isDevOtpEnabledFor(mobile) ? otp : undefined,
        expiresAt,
      });
    }

    const useDevOtp = isDevOtpEnabledFor(mobile);
    if (useDevOtp && process.env.NODE_ENV === "production") {
      console.warn(
        "[request-otp] Test OTP mode is active in production for an allowlisted number. Disable AUTH_DEV_OTP before public launch.",
      );
    }

    if (!useDevOtp && isSupabaseAuthConfigured()) {
      try {
        await sendSupabaseOtp(mobile);
        return NextResponse.json({
          ok: true,
          signedIn: false,
          mobile,
          isExisting: Boolean(existing),
          role,
          name: providedName ? existing?.name ?? null : null,
        });
      } catch (smsError) {
        console.warn("[request-otp] Supabase SMS send failed, falling back to dev OTP:", smsError);
      }
    }

    const challenge = await createOtpChallenge(mobile, role);
    return NextResponse.json({
      ok: true,
      signedIn: false,
      mobile,
      // Only exposed in local development or when AUTH_DEV_OTP is explicitly on.
      devOtp: challenge.otp,
      expiresAt: challenge.expiresAt,
      isExisting: Boolean(existing),
      role,
      name: providedName ? existing?.name ?? null : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
