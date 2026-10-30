import { cookies } from "next/headers";
import { randomBytes, randomUUID } from "crypto";
import { mutateDb, getDb } from "./db";
import type {
  FarmerProfile,
  Language,
  OwnerProfile,
  Role,
  SessionUser,
  User,
} from "./types";

export const SESSION_COOKIE = "kt_session";
const SESSION_DAYS = 7;
export const DEMO_OTP = "123456";

export function normalizeMobile(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export function isValidMobile(mobile: string): boolean {
  return /^[6-9]\d{9}$/.test(mobile);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const session = db.sessions.find((s) => s.token === token);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) return null;
  const user = db.users.find((u) => u.id === session.userId);
  if (!user) return null;
  const farmerProfile = db.farmerProfiles.find((p) => p.userId === user.id);
  const ownerProfile = db.ownerProfiles.find((p) => p.userId === user.id);
  return { ...user, farmerProfile, ownerProfile };
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  await mutateDb((db) => {
    db.sessions = db.sessions.filter(
      (s) => new Date(s.expiresAt).getTime() > Date.now(),
    );
    db.sessions.push({
      token,
      userId,
      createdAt: new Date().toISOString(),
      expiresAt,
    });
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return token;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await mutateDb((db) => {
      db.sessions = db.sessions.filter((s) => s.token !== token);
    });
  }
  jar.delete(SESSION_COOKIE);
}

export async function createOtpChallenge(
  mobile: string,
  role: Role | null,
): Promise<{ otp: string; expiresAt: string }> {
  const otp = DEMO_OTP;
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await mutateDb((db) => {
    db.otpChallenges = db.otpChallenges.filter(
      (challenge) =>
        new Date(challenge.expiresAt).getTime() > Date.now() &&
        challenge.mobile !== mobile,
    );
    db.otpChallenges.push({
      id: randomUUID(),
      mobile,
      otp,
      role,
      expiresAt,
      createdAt: new Date().toISOString(),
    });
  });
  return { otp, expiresAt };
}

export async function verifyOtpChallenge(
  mobile: string,
  otp: string,
): Promise<{ ok: boolean; reason?: string }> {
  const db = await getDb();
  const challenge = db.otpChallenges
    .filter((item) => item.mobile === mobile)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!challenge) return { ok: false, reason: "Request a new OTP first." };
  if (new Date(challenge.expiresAt).getTime() < Date.now()) {
    return { ok: false, reason: "This OTP has expired. Request a new one." };
  }
  if (challenge.otp !== otp) {
    return { ok: false, reason: "That OTP does not match. Please try again." };
  }
  return { ok: true };
}

export async function findOrCreateUser(input: {
  mobile: string;
  name?: string;
  role?: Role;
  language?: Language;
}): Promise<{ user: User; isNew: boolean }> {
  const db = await getDb();
  const existing = db.users.find((u) => u.mobile === input.mobile);
  if (existing) return { user: existing, isNew: false };
  const role: Role = input.role === "owner" ? "owner" : "farmer";
  const userId = `usr_${randomUUID()}`;
  const now = new Date().toISOString();
  const user: User = {
    id: userId,
    name: input.name?.trim() || (role === "owner" ? "Tractor Owner" : "Farmer"),
    mobile: input.mobile,
    role,
    preferredLanguage: input.language ?? "en",
    profilePhoto: null,
    createdAt: now,
  };
  await mutateDb((database) => {
    database.users.push(user);
    if (role === "farmer") {
      const profile: FarmerProfile = {
        userId,
        address: "Niphad",
        village: "Niphad",
        district: "Nashik",
        state: "Maharashtra",
        lat: 20.0833,
        lng: 73.9333,
      };
      database.farmerProfiles.push(profile);
    } else {
      const profile: OwnerProfile = {
        userId,
        address: "Niphad",
        village: "Niphad",
        district: "Nashik",
        state: "Maharashtra",
        lat: 20.0833,
        lng: 73.9333,
        online: true,
        serviceRadiusKm: 10,
        payment: {
          shareUpi: false,
          upiId: "",
          shareQr: false,
          qrImage: "",
          shareBank: false,
          bankAccountName: user.name,
          bankAccountNumber: "",
          bankIfsc: "",
          preferredMethod: "cash",
        },
      };
      database.ownerProfiles.push(profile);
    }
  });
  return { user, isNew: true };
}
