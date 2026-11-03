import { NextResponse } from "next/server";
import {
  createOtpChallenge,
  createSession,
  isDevOtpEnabled,
  isTrustedDevice,
  isValidMobile,
  normalizeMobile,
  rememberDevice,
  sendSupabaseOtp,
  validateStoredIdentity,
} from "@/lib/auth";
import { getDb } from "@/lib/db";
import { handleApiError, jsonError, readJson } from "@/lib/http";
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

    const db = await getDb();
    const existing = db.users.find((u) => u.mobile === mobile);
    const role: Role | null = existing?.role ?? body.role ?? null;
    if (!existing && !role) {
      return jsonError("Please choose whether you are a farmer or tractor owner.", 400);
    }

    // A returning user must still type the name saved for this mobile number.
    // This blocks signing into an account with someone else's name or a phone
    // number that does not belong to the stored account.
    const identity = await validateStoredIdentity(mobile, body.name);
    if (!identity.ok) {
      return NextResponse.json(
        { error: identity.reason, code: "identity_mismatch" },
        { status: 400 },
      );
    }

    // A browser that already completed an OTP for this exact account is
    // trusted, so a returning user only has to enter their phone number.
    if (existing && (await isTrustedDevice(existing.id, mobile))) {
      await createSession(existing.id);
      await rememberDevice(existing);
      return NextResponse.json({
        ok: true,
        signedIn: true,
        isNew: false,
        mobile,
        role: existing.role,
        name: existing.name,
      });
    }

    const useDevOtp = isDevOtpEnabled();

    if (!useDevOtp && isSupabaseAuthConfigured()) {
      try {
        await sendSupabaseOtp(mobile);
        return NextResponse.json({
          ok: true,
          signedIn: false,
          mobile,
          isExisting: Boolean(existing),
          role,
          name: existing?.name ?? null,
        });
      } catch (smsError) {
        console.warn("[request-otp] Supabase SMS send failed:", smsError);
        return jsonError(
          "We could not send the OTP right now. Please try again in a few minutes.",
          503,
        );
      }
    }

    if (!useDevOtp) {
      return jsonError(
        "Phone sign-in is not configured. Please contact support.",
        503,
      );
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
      name: existing?.name ?? null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
