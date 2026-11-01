import { cookies } from "next/headers";
import {
  createHmac,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "crypto";
import { mutateDb, getDb } from "./db";
import {
  getSupabaseAdmin,
  getSupabaseAuth,
  isSupabaseAuthConfigured,
  isSupabaseDatabaseConfigured,
} from "./supabase";
import type {
  FarmerProfile,
  Language,
  OwnerProfile,
  Role,
  SessionUser,
  User,
} from "./types";

export const SESSION_COOKIE = "kt_session";
const DEVICE_COOKIE = "kt_device";
const SESSION_DAYS = 7;
const DEVICE_DAYS = 365;
const SESSION_TTL_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;
const DEVICE_TTL_MS = DEVICE_DAYS * 24 * 60 * 60 * 1000;

/**
 * Sessions are signed, self-contained cookies instead of database rows.
 * Vercel (and other serverless hosts) run each request on an isolated
 * instance, so a session written during login is not guaranteed to be readable
 * by the page render that follows. A signed token keeps login working across
 * instances. SESSION_SECRET is required in production.
 */
function sessionSecret(): string {
  return (
    process.env.SESSION_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    "kisantractor-session-secret-fallback-token"
  );
}

type SessionTokenPayload = {
  userId: string;
  exp: number;
  user?: User;
  farmerProfile?: FarmerProfile;
  ownerProfile?: OwnerProfile;
};

function signPayload(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
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

type DeviceTokenPayload = {
  userId: string;
  mobile: string;
  exp: number;
};

function encodeDeviceToken(userId: string, mobile: string): string {
  const payload: DeviceTokenPayload = {
    userId,
    mobile,
    exp: Date.now() + DEVICE_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signPayload(encoded)}`;
}

function decodeDeviceToken(token: string): DeviceTokenPayload | null {
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;
  const encoded = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const provided = Buffer.from(signature);
  const wanted = Buffer.from(signPayload(encoded));
  if (
    provided.length !== wanted.length ||
    !timingSafeEqual(provided, wanted)
  ) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Partial<DeviceTokenPayload>;
    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.mobile !== "string" ||
      typeof parsed.exp !== "number" ||
      parsed.exp < Date.now()
    ) {
      return null;
    }
    return {
      userId: parsed.userId,
      mobile: parsed.mobile,
      exp: parsed.exp,
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

/**
 * Shown when the name typed at sign-in does not belong to the account stored
 * for that mobile number. The wording is intentionally explicit so a farmer
 * can correct the entry without guessing what went wrong.
 */
export const IDENTITY_MISMATCH_MESSAGE =
  "Enter invalid name or phone number, please enter correct to login";

const GENERIC_NAMES = new Set([
  "farmer",
  "tractor owner",
  "tractorowner",
  "owner",
  "user",
  "kisan",
]);

function normalizeNameForMatch(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isMeaningfulName(value: string | null | undefined): boolean {
  const normalized = normalizeNameForMatch(value);
  return normalized.length > 1 && !GENERIC_NAMES.has(normalized);
}

export function namesMatch(
  storedName: string | null | undefined,
  providedName: string | null | undefined,
): boolean {
  const stored = normalizeNameForMatch(storedName);
  const provided = normalizeNameForMatch(providedName);
  if (!stored || !provided) return true;
  if (stored === provided) return true;
  // Accept a first name or a shorter form of the saved full name, but never a
  // different person's name.
  const storedParts = stored.split(" ");
  const providedParts = provided.split(" ");
  if (providedParts.length === 1) {
    return storedParts.includes(provided);
  }
  if (storedParts.length === 1) {
    return providedParts.includes(stored);
  }
  return false;
}

type SupabaseIdentity = { id: string; name: string | null };

/** Look up the phone number in Supabase Auth (the authoritative account store). */
async function findSupabaseIdentity(
  mobile: string,
): Promise<SupabaseIdentity | null> {
  if (!isSupabaseDatabaseConfigured()) return null;
  try {
    const admin = getSupabaseAdmin();
    const phoneVariants = [
      `+91${mobile}`,
      mobile,
      `91${mobile}`,
    ];
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const authUser = data?.users?.find((user) =>
      phoneVariants.includes(user.phone ?? ""),
    );
    if (!authUser) return null;
    const metadata = authUser.user_metadata as Record<string, unknown> | undefined;
    const name =
      typeof metadata?.name === "string"
        ? metadata.name
        : typeof metadata?.full_name === "string"
          ? metadata.full_name
          : null;
    return { id: authUser.id, name };
  } catch (error) {
    console.warn("[auth] Could not read Supabase identity:", error);
    return null;
  }
}

/**
 * Reject a sign-in where the supplied name does not match the account already
 * stored for that mobile number (local app_state or Supabase Auth metadata).
 */
export async function validateStoredIdentity(
  mobile: string,
  providedName?: string | null,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const provided = (providedName ?? "").trim();
  if (!provided) return { ok: true };

  const db = await getDb();
  const existing = db.users.find((user) => user.mobile === mobile);
  if (
    existing &&
    isMeaningfulName(existing.name) &&
    !namesMatch(existing.name, provided)
  ) {
    return { ok: false, reason: IDENTITY_MISMATCH_MESSAGE };
  }

  const supabaseIdentity = await findSupabaseIdentity(mobile);
  if (
    supabaseIdentity?.name &&
    isMeaningfulName(supabaseIdentity.name) &&
    !namesMatch(supabaseIdentity.name, provided)
  ) {
    return { ok: false, reason: IDENTITY_MISMATCH_MESSAGE };
  }

  return { ok: true };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
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
    // them over the stored record so a read that races a write cannot revert a
    // saved village or auto-detected coordinates. Sensitive fields stay in the
    // store only.
    const farmerProfile: FarmerProfile | undefined = snapFarmer
      ? {
          ...(dbFarmer ?? {}),
          ...snapFarmer,
          documents: dbFarmer?.documents ?? snapFarmer.documents,
        }
      : dbFarmer;

    let ownerProfile: OwnerProfile | undefined = snapOwner
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

    if (dbUser.role === "owner" && !ownerProfile) {
      ownerProfile = {
        userId: dbUser.id,
        address: farmerProfile?.address || "",
        village: farmerProfile?.village || "",
        district: farmerProfile?.district || "Nashik",
        state: farmerProfile?.state || "Maharashtra",
        pincode: farmerProfile?.pincode || "",
        lat: farmerProfile?.lat || 20.0,
        lng: farmerProfile?.lng || 73.8,
        online: true,
        serviceRadiusKm: 15,
        payment: {
          shareUpi: false,
          upiId: "",
          shareQr: false,
          qrImage: "",
          shareBank: false,
          bankAccountName: dbUser.name,
          bankAccountNumber: "",
          bankIfsc: "",
          preferredMethod: "cash",
        },
      };
    }

    return {
      ...dbUser,
      ...(decoded?.user ?? {}),
      profilePhoto: dbUser.profilePhoto ?? decoded?.user?.profilePhoto ?? null,
      farmerProfile,
      ownerProfile,
    };
  } catch (err) {
    console.warn("[KisanTractor] Failed to get session user:", err);
    return null;
  }
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
 * Re-issue the signed cookie after a profile write so the latest saved values
 * are available to the next request.
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

/** True when a local development OTP may be generated instead of sending SMS. */
export function isDevOtpEnabled(): boolean {
  if (process.env.AUTH_DEV_OTP === "true") return true;
  if (process.env.AUTH_DEV_OTP === "false") return false;
  return true;
}

/** Remember this browser so the next login only needs the phone number. */
export async function rememberDevice(user: User): Promise<void> {
  const jar = await cookies();
  jar.set(DEVICE_COOKIE, encodeDeviceToken(user.id, user.mobile), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DEVICE_DAYS * 24 * 60 * 60,
  });
}

/** Check the trusted-device cookie without revealing why it failed. */
export async function isTrustedDevice(
  userId: string,
  mobile: string,
): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(DEVICE_COOKIE)?.value;
  if (!token) return false;
  const decoded = decodeDeviceToken(token);
  return Boolean(
    decoded && decoded.userId === userId && decoded.mobile === mobile,
  );
}

/** Send a real phone OTP through Supabase Auth. */
export async function sendSupabaseOtp(mobile: string): Promise<void> {
  const supabase = getSupabaseAuth();
  const { error } = await supabase.auth.signInWithOtp({
    phone: `+91${mobile}`,
    options: { shouldCreateUser: true },
  });
  if (error) {
    throw new Error(
      error.message || "Could not send the OTP. Please try again.",
    );
  }
}

/** Verify a Supabase phone OTP and return the Supabase user id. */
export async function verifySupabaseOtp(
  mobile: string,
  token: string,
): Promise<{ supabaseUserId: string } | { error: string }> {
  const supabase = getSupabaseAuth();
  const { data, error } = await supabase.auth.verifyOtp({
    phone: `+91${mobile}`,
    token,
    type: "sms",
  });
  if (error || !data.user) {
    return {
      error: error?.message || "That OTP is not valid. Please try again.",
    };
  }
  return { supabaseUserId: data.user.id };
}

/** Development-only OTP. Never used when Supabase Auth is configured. */
export async function createOtpChallenge(
  mobile: string,
  role: Role | null,
): Promise<{ otp: string; expiresAt: string }> {
  if (!isDevOtpEnabled()) {
    throw new Error("Development OTPs are disabled.");
  }
  const otp = String(randomInt(100000, 1000000));
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
  id?: string;
  mobile: string;
  name?: string;
  role?: Role;
  language?: Language;
}): Promise<{ user: User; isNew: boolean }> {
  let userId = input.id;
  const role: Role = input.role === "owner" ? "owner" : "farmer";
  const name = input.name?.trim() || (role === "owner" ? "Tractor Owner" : "Farmer");

  // Sync / create in Supabase Authentication so the user appears in the Supabase Dashboard
  if (isSupabaseDatabaseConfigured()) {
    try {
      const admin = getSupabaseAdmin();
      const phone = `+91${input.mobile}`;
      const phoneVariants = [
        phone,
        input.mobile,
        `91${input.mobile}`,
        `+91${input.mobile}`,
      ];

      const { data: userList } = await admin.auth.admin.listUsers();
      let authUser = userList?.users?.find((u) =>
        phoneVariants.includes(u.phone ?? ""),
      );

      if (!authUser) {
        const { data: created, error } = await admin.auth.admin.createUser({
          phone,
          phone_confirm: true,
          user_metadata: {
            name,
            role,
          },
        });
        if (created?.user) {
          authUser = created.user;
        } else if (error?.message?.toLowerCase().includes("already")) {
          const { data: refetched } = await admin.auth.admin.listUsers();
          authUser = refetched?.users?.find((u) =>
            phoneVariants.includes(u.phone ?? ""),
          );
        } else if (error) {
          console.warn("[findOrCreateUser] Supabase auth.admin.createUser error:", error.message);
        }
      }

      if (authUser?.id) {
        userId = authUser.id;
      }
    } catch (err) {
      console.warn("[findOrCreateUser] Supabase auth sync error:", err);
    }
  }

  const db = await getDb();
  const existing = db.users.find((u) => u.mobile === input.mobile);
  if (existing) {
    const targetUserId = userId || existing.id;
    await mutateDb((database) => {
      const u = database.users.find((item) => item.mobile === input.mobile);
      if (u) {
        if (userId && u.id !== userId) u.id = userId;
        if (input.role && input.role !== u.role) u.role = input.role;
      }
      if (userId && existing.id !== userId) {
        const oldId = existing.id;
        const newId = userId;
        const fp = database.farmerProfiles.find((p) => p.userId === oldId);
        if (fp) fp.userId = newId;
        const op = database.ownerProfiles.find((p) => p.userId === oldId);
        if (op) op.userId = newId;
        database.bookings.forEach((b) => {
          if (b.farmerId === oldId) b.farmerId = newId;
        });
        database.tractors.forEach((t) => {
          if (t.ownerId === oldId) t.ownerId = newId;
        });
      }

      const activeRole = input.role || existing.role;
      if (activeRole === "owner" && !database.ownerProfiles.some((p) => p.userId === targetUserId)) {
        database.ownerProfiles.push({
          userId: targetUserId,
          address: "",
          village: "",
          district: "Nashik",
          state: "Maharashtra",
          pincode: "",
          lat: 20.0,
          lng: 73.8,
          online: true,
          serviceRadiusKm: 15,
          payment: {
            shareUpi: false,
            upiId: "",
            shareQr: false,
            qrImage: "",
            shareBank: false,
            bankAccountName: existing.name,
            bankAccountNumber: "",
            bankIfsc: "",
            preferredMethod: "cash",
          },
        });
      }
      if (activeRole === "farmer" && !database.farmerProfiles.some((p) => p.userId === targetUserId)) {
        database.farmerProfiles.push({
          userId: targetUserId,
          address: "",
          village: "",
          district: "Nashik",
          state: "Maharashtra",
          pincode: "",
          lat: 20.0,
          lng: 73.8,
        });
      }
    });

    if (userId) existing.id = userId;
    if (input.role) existing.role = input.role;
    return { user: existing, isNew: false };
  }

  userId = userId || `usr_${randomUUID()}`;
  const now = new Date().toISOString();
  const user: User = {
    id: userId,
    name,
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
        address: "",
        village: "",
        district: "",
        state: "",
        pincode: "",
        lat: 0,
        lng: 0,
      };
      database.farmerProfiles.push(profile);
    } else {
      const profile: OwnerProfile = {
        userId,
        address: "",
        village: "",
        district: "",
        state: "",
        pincode: "",
        lat: 0,
        lng: 0,
        online: true,
        serviceRadiusKm: 15,
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
