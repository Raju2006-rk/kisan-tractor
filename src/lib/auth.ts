import { cookies } from "next/headers";
import {
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "crypto";
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
const SESSION_TTL_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;
export const DEMO_OTP = "123456";

/**
 * Sessions are signed, self-contained cookies instead of database rows.
 * Vercel (and other serverless hosts) run each request on an isolated
 * instance with its own ephemeral filesystem, so a session written during
 * login is not guaranteed to be readable by the page render that follows.
 * A signed token keeps login working across instances. Set SESSION_SECRET
 * in production to replace the demo fallback.
 */
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  process.env.AUTH_SECRET ||
  "kisantractor-demo-session-secret-v1";

type SessionTokenPayload = {
  userId: string;
  exp: number;
  user?: User;
  farmerProfile?: FarmerProfile;
  ownerProfile?: OwnerProfile;
};

function signPayload(payload: string): string {
  return createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
}

function encodeSessionToken(
  userId: string,
  snapshot: Pick<
    SessionTokenPayload,
    "user" | "farmerProfile" | "ownerProfile"
  > = {},
): string {
  const payload: SessionTokenPayload = {
    userId,
    exp: Date.now() + SESSION_TTL_MS,
    ...snapshot,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signPayload(encoded)}`;
}

function decodeSessionToken(token: string): SessionTokenPayload | null {
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;
  const encoded = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = signPayload(encoded);
  const provided = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (
    provided.length !== wanted.length ||
    !timingSafeEqual(provided, wanted)
  ) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Partial<SessionTokenPayload>;
    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.exp !== "number" ||
      parsed.exp < Date.now()
    ) {
      return null;
    }
    return {
      userId: parsed.userId,
      exp: parsed.exp,
      user: parsed.user,
      farmerProfile: parsed.farmerProfile,
      ownerProfile: parsed.ownerProfile,
    };
  } catch {
    return null;
  }
}

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
  const decoded = decodeSessionToken(token);
  let userId = decoded?.userId ?? null;

  if (!userId) {
    // Backwards compatibility for sessions created before signed cookies.
    const session = db.sessions.find((s) => s.token === token);
    if (!session) return null;
    if (new Date(session.expiresAt).getTime() < Date.now()) return null;
    userId = session.userId;
  }

  const dbUser = db.users.find((u) => u.id === userId) ?? decoded?.user;
  if (!dbUser) return null;

  const dbFarmer = db.farmerProfiles.find((p) => p.userId === userId);
  const dbOwner = db.ownerProfiles.find((p) => p.userId === userId);
  const snapFarmer = decoded?.farmerProfile;
  const snapOwner = decoded?.ownerProfile;

  // The signed cookie carries the last profile values this user saved. Prefer
  // them over the per-instance JSON store, which is re-seeded on every fresh
  // serverless instance and would otherwise revert saved villages and
  // auto-detected coordinates. Sensitive fields stay in the store only.
  const farmerProfile: FarmerProfile | undefined = snapFarmer
    ? {
        ...(dbFarmer ?? {}),
        ...snapFarmer,
        documents: dbFarmer?.documents ?? snapFarmer.documents,
      }
    : dbFarmer;

  const ownerProfile: OwnerProfile | undefined = snapOwner
    ? {
        ...(dbOwner ?? {}),
        ...snapOwner,
        documents: dbOwner?.documents ?? snapOwner.documents,
        payment: {
          ...snapOwner.payment,
          upiId: dbOwner?.payment.upiId || snapOwner.payment.upiId,
          qrImage: dbOwner?.payment.qrImage || snapOwner.payment.qrImage,
          bankAccountNumber:
            dbOwner?.payment.bankAccountNumber ||
            snapOwner.payment.bankAccountNumber,
          bankIfsc:
            dbOwner?.payment.bankIfsc || snapOwner.payment.bankIfsc,
        },
      }
    : dbOwner;

  return {
    ...dbUser,
    ...(decoded?.user ?? {}),
    profilePhoto: dbUser.profilePhoto ?? decoded?.user?.profilePhoto ?? null,
    farmerProfile,
    ownerProfile,
  };
}

async function writeSessionCookie(userId: string): Promise<string> {
  const db = await getDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) {
    throw new Error("Cannot create a session for an unknown user.");
  }
  const farmerProfile = db.farmerProfiles.find((p) => p.userId === userId);
  const ownerProfile = db.ownerProfiles.find((p) => p.userId === userId);
  const token = encodeSessionToken(userId, {
    // Keep the cookie small: uploaded photos and QR images are not echoed back.
    user: { ...user, profilePhoto: null },
    farmerProfile: farmerProfile
      ? { ...farmerProfile, documents: undefined }
      : undefined,
    ownerProfile: ownerProfile
      ? {
          ...ownerProfile,
          documents: undefined,
          payment: {
            ...ownerProfile.payment,
            upiId: "",
            qrImage: "",
            bankAccountNumber: "",
            bankIfsc: "",
          },
        }
      : undefined,
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

export async function createSession(userId: string): Promise<string> {
  return writeSessionCookie(userId);
}

/**
 * Re-issue the signed cookie after a profile write so the saved values survive
 * on a different serverless instance (which only has the seed JSON store).
 */
export async function refreshSession(userId: string): Promise<void> {
  const jar = await cookies();
  if (!jar.get(SESSION_COOKIE)?.value) return;
  const db = await getDb();
  if (!db.users.some((u) => u.id === userId)) return;
  await writeSessionCookie(userId);
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
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
