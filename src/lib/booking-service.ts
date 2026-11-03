import { randomUUID } from "crypto";
import { getDb, mutateDb } from "./db";
import {
  ACTIVE_STATUSES,
  CANCELLABLE_STATUSES,
  LANGUAGES,
  PHOTOS,
  SERVICES,
  TERMINAL_STATUSES,
} from "./constants";
import { calculateAmount } from "./pricing";
import type {
  Booking,
  BookingDetail,
  BookingStatus,
  Database,
  Dispute,
  FarmerProfile,
  Language,
  Notification,
  OwnerEarningRecord,
  OwnerEarningsSummary,
  OwnerProfile,
  PaymentMethod,
  Pricing,
  PricingType,
  Role,
  ServiceType,
  SessionUser,
  StatusHistory,
  Tractor,
  TractorEarnings,
  TractorWithOwner,
  UserDocuments,
  WorkSession,
} from "./types";
import {
  computeActiveMinutes,
  haversineKm,
  minutesToTime,
  timeToMinutes,
  todayISO,
} from "./utils";

export class ServiceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function isActiveStatus(status: BookingStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

export function isTerminalStatus(status: BookingStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function getPricing(db: Database, tractorId: string): Pricing {
  const pricing = db.pricing.find((p) => p.tractorId === tractorId);
  if (!pricing) throw new ServiceError("Pricing is not configured for this tractor.", 404);
  return pricing;
}

export function getTractor(db: Database, tractorId: string): Tractor {
  const tractor = db.tractors.find((t) => t.id === tractorId);
  if (!tractor) throw new ServiceError("Tractor not found.", 404);
  return tractor;
}

export function ensureOwnerProfile(db: Database, userId: string): OwnerProfile {
  let profile = db.ownerProfiles.find((p) => p.userId === userId);
  if (!profile) {
    const user = db.users.find((u) => u.id === userId);
    const farmer = db.farmerProfiles.find((p) => p.userId === userId);
    profile = {
      userId,
      address: farmer?.address || "",
      village: farmer?.village || "",
      district: farmer?.district || "Nashik",
      state: farmer?.state || "Maharashtra",
      pincode: farmer?.pincode || "",
      lat: farmer?.lat || 20.0,
      lng: farmer?.lng || 73.8,
      online: true,
      serviceRadiusKm: 15,
      payment: {
        shareUpi: false,
        upiId: "",
        shareQr: false,
        qrImage: "",
        shareBank: false,
        bankAccountName: user?.name || "Tractor Owner",
        bankAccountNumber: "",
        bankIfsc: "",
        preferredMethod: "cash",
      },
    };
    db.ownerProfiles.push(profile);
  }
  return profile;
}

export function ensureFarmerProfile(db: Database, userId: string): FarmerProfile {
  let profile = db.farmerProfiles.find((p) => p.userId === userId);
  if (!profile) {
    const owner = db.ownerProfiles.find((p) => p.userId === userId);
    profile = {
      userId,
      address: owner?.address || "",
      village: owner?.village || "",
      district: owner?.district || "Nashik",
      state: owner?.state || "Maharashtra",
      pincode: owner?.pincode || "",
      lat: owner?.lat || 20.0,
      lng: owner?.lng || 73.8,
    };
    db.farmerProfiles.push(profile);
  }
  return profile;
}

export function getOwnerProfile(db: Database, ownerId: string): OwnerProfile {
  return ensureOwnerProfile(db, ownerId);
}

export function getFarmerProfile(db: Database, farmerId: string): FarmerProfile {
  return ensureFarmerProfile(db, farmerId);
}

export function bookingPartyIds(booking: Booking, db: Database): {
  ownerId: string;
  farmerId: string;
} {
  const tractor = getTractor(db, booking.tractorId);
  return { ownerId: tractor.ownerId, farmerId: booking.farmerId };
}

export function isBookingParty(
  db: Database,
  booking: Booking,
  userId: string,
): boolean {
  const { ownerId, farmerId } = bookingPartyIds(booking, db);
  return ownerId === userId || farmerId === userId;
}

export function userRoleInBooking(
  db: Database,
  booking: Booking,
  userId: string,
): Role | null {
  const { ownerId, farmerId } = bookingPartyIds(booking, db);
  if (farmerId === userId) return "farmer";
  if (ownerId === userId) return "owner";
  return null;
}

function notify(
  db: Database,
  userId: string,
  title: string,
  body: string,
  type: Notification["type"],
  bookingId?: string,
) {
  db.notifications.unshift({
    id: `notif_${randomUUID()}`,
    userId,
    title,
    body,
    type,
    bookingId: bookingId ?? null,
    read: false,
    createdAt: new Date().toISOString(),
  });
}

function addHistory(
  db: Database,
  booking: Booking,
  oldStatus: BookingStatus | null,
  newStatus: BookingStatus,
  actorId: string,
  actorRole: Role | "system",
  reason: string,
) {
  const entry: StatusHistory = {
    id: `hist_${randomUUID()}`,
    bookingId: booking.id,
    oldStatus,
    newStatus,
    changedBy: actorId,
    changedByRole: actorRole,
    reason,
    createdAt: new Date().toISOString(),
  };
  db.bookingStatusHistory.push(entry);
  booking.updatedAt = entry.createdAt;
}

function changeStatus(
  db: Database,
  booking: Booking,
  newStatus: BookingStatus,
  actorId: string,
  actorRole: Role | "system",
  reason: string,
) {
  const oldStatus = booking.status;
  booking.status = newStatus;
  addHistory(db, booking, oldStatus, newStatus, actorId, actorRole, reason);
}

function sessionFor(db: Database, bookingId: string): WorkSession | undefined {
  return db.workSessions.find((s) => s.bookingId === bookingId);
}

function closeOpenSegment(session: WorkSession, at = new Date()) {
  const last = session.segments[session.segments.length - 1];
  if (last && !last.end) last.end = at.toISOString();
  session.totalMinutes = computeActiveMinutes(session.segments, at);
}

function ensureSession(db: Database, bookingId: string): WorkSession {
  const existing = sessionFor(db, bookingId);
  if (existing) return existing;
  const now = new Date().toISOString();
  const session: WorkSession = {
    id: `ws_${randomUUID()}`,
    bookingId,
    segments: [{ start: now, end: null }],
    totalMinutes: 0,
    createdAt: now,
  };
  db.workSessions.push(session);
  return session;
}

export function buildBookingDetail(
  db: Database,
  booking: Booking,
): BookingDetail {
  const farmer = db.users.find((u) => u.id === booking.farmerId);
  const tractor = db.tractors.find((t) => t.id === booking.tractorId);
  const owner = tractor
    ? db.users.find((u) => u.id === tractor.ownerId)
    : undefined;
  if (!farmer || !tractor || !owner) {
    throw new ServiceError("Booking records are incomplete.", 500);
  }
  const pricing = db.pricing.find((p) => p.tractorId === tractor.id);
  if (!pricing) throw new ServiceError("Pricing record is missing.", 500);
  const ownerProfile = db.ownerProfiles.find((p) => p.userId === owner.id);
  if (!ownerProfile) throw new ServiceError("Owner profile is missing.", 500);
  return {
    ...booking,
    farmer,
    owner,
    ownerProfile,
    tractor,
    pricing,
    workSession: sessionFor(db, booking.id) ?? null,
    measurement:
      db.workMeasurements.find((m) => m.bookingId === booking.id) ?? null,
    payments: db.paymentRecords
      .filter((p) => p.bookingId === booking.id)
      .sort((a, b) => a.paidAt.localeCompare(b.paidAt)),
    history: db.bookingStatusHistory
      .filter((h) => h.bookingId === booking.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    dispute: db.disputes.find((d) => d.bookingId === booking.id) ?? null,
    canReview:
      booking.status === "BILL_GENERATED" ||
      booking.status === "PAYMENT_PENDING" ||
      booking.status === "DISPUTED",
  };
}

export async function getBookingDetail(
  bookingId: string,
  userId: string,
): Promise<BookingDetail> {
  const db = await getDb();
  const booking = db.bookings.find((b) => b.id === bookingId);
  if (!booking) throw new ServiceError("Booking not found.", 404);
  if (!isBookingParty(db, booking, userId)) {
    throw new ServiceError("You do not have access to this booking.", 403);
  }
  return buildBookingDetail(db, booking);
}

export async function listBookingsForUser(
  userId: string,
): Promise<BookingDetail[]> {
  await expirePendingBookings();
  const db = await getDb();
  const tractorIds = db.tractors
    .filter((t) => t.ownerId === userId)
    .map((t) => t.id);
  const rows = db.bookings
    .filter((b) => b.farmerId === userId || tractorIds.includes(b.tractorId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return rows.map((booking) => buildBookingDetail(db, booking));
}

export async function expirePendingBookings(): Promise<number> {
  const db = await getDb();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const stale = db.bookings.filter(
    (b) =>
      b.status === "PENDING" && new Date(b.createdAt).getTime() < cutoff,
  );
  if (stale.length === 0) return 0;
  await mutateDb((draft) => {
    for (const staleBooking of stale) {
      const booking = draft.bookings.find((b) => b.id === staleBooking.id);
      if (!booking || booking.status !== "PENDING") continue;
      changeStatus(
        draft,
        booking,
        "EXPIRED",
        "system",
        "system",
        "Owner did not respond within 24 hours",
      );
      notify(
        draft,
        booking.farmerId,
        "Booking expired",
        `Your request ${booking.id} expired because the owner did not respond in time. You can book again.`,
        "booking",
        booking.id,
      );
    }
  });
  return stale.length;
}

export function listTractors(
  db: Database,
  options: {
    lat?: number;
    lng?: number;
    service?: ServiceType;
    pricingType?: PricingType;
    maxDistanceKm?: number;
    query?: string;
    onlineOnly?: boolean;
    ownerId?: string;
    sort?: "nearest" | "price" | "rating";
  } = {},
): TractorWithOwner[] {
  const {
    lat,
    lng,
    service,
    pricingType,
    maxDistanceKm,
    query,
    onlineOnly = true,
    ownerId,
    sort = "nearest",
  } = options;
  const serviceEquipment: Record<ServiceType, string> = {
    ploughing: "eq_plough",
    rotavation: "eq_rotavator",
    trolley: "eq_trolley",
  };
  const rows: TractorWithOwner[] = [];
  for (const tractor of db.tractors) {
    if (tractor.status !== "active" && !ownerId) continue;
    if (ownerId && tractor.ownerId !== ownerId) continue;
    const owner = db.users.find((u) => u.id === tractor.ownerId);
    const ownerProfile = db.ownerProfiles.find(
      (p) => p.userId === tractor.ownerId,
    );
    const pricing = db.pricing.find((p) => p.tractorId === tractor.id);
    if (!owner || !ownerProfile || !pricing) continue;
    if (onlineOnly && !ownerId && !ownerProfile.online) continue;
    if (service && !tractor.equipmentIds.includes(serviceEquipment[service])) {
      continue;
    }
    if (pricingType) {
      const enabled =
        pricingType === "hourly"
          ? pricing.hourlyEnabled
          : pricingType === "acre"
            ? pricing.acreEnabled
            : pricing.tripEnabled;
      if (!enabled) continue;
    }
    const distanceKm =
      lat !== undefined && lng !== undefined
        ? haversineKm({ lat, lng }, { lat: tractor.lat, lng: tractor.lng })
        : 0;
    if (maxDistanceKm !== undefined && distanceKm > maxDistanceKm) continue;
    // Farmers only see owners who actually serve their area. Owner listings
    // (`owner=me`) are never filtered so an owner can always manage their fleet.
    if (!ownerId && distanceKm > tractor.serviceRadiusKm) continue;
    const equipment = db.equipment.filter((e) =>
      tractor.equipmentIds.includes(e.id),
    );
    if (query) {
      const haystack = [
        tractor.brand,
        tractor.model,
        tractor.village,
        tractor.district,
        owner.name,
        ...equipment.map((e) => e.name),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query.toLowerCase())) continue;
    }
    rows.push({
      ...tractor,
      owner: { id: owner.id, name: owner.name, mobile: owner.mobile },
      ownerProfile,
      pricing,
      equipment,
      distanceKm,
      isAvailable: ownerProfile.online && tractor.status === "active",
    });
  }
  rows.sort((a, b) => {
    if (sort === "price") {
      const priceA = Math.min(
        a.pricing.hourlyEnabled ? a.pricing.hourlyRate : Infinity,
        a.pricing.acreEnabled ? a.pricing.acreRate : Infinity,
        a.pricing.tripEnabled ? a.pricing.tripRate : Infinity,
      );
      const priceB = Math.min(
        b.pricing.hourlyEnabled ? b.pricing.hourlyRate : Infinity,
        b.pricing.acreEnabled ? b.pricing.acreRate : Infinity,
        b.pricing.tripEnabled ? b.pricing.tripRate : Infinity,
      );
      return priceA - priceB;
    }
    return a.distanceKm - b.distanceKm;
  });
  return rows;
}

export async function searchTractors(options: {
  userId?: string;
  lat?: number;
  lng?: number;
  service?: ServiceType;
  pricingType?: PricingType;
  maxDistanceKm?: number;
  query?: string;
  ownerId?: string;
}): Promise<TractorWithOwner[]> {
  const db = await getDb();
  let lat = options.lat;
  let lng = options.lng;
  if (lat === undefined || lng === undefined) {
    if (options.userId) {
      const user = db.users.find((u) => u.id === options.userId);
      if (user) {
        const profile =
          db.farmerProfiles.find((p) => p.userId === user.id) ??
          db.ownerProfiles.find((p) => p.userId === user.id);
        if (profile) {
          lat = profile.lat;
          lng = profile.lng;
        }
      }
    }
  }
  return listTractors(db, { ...options, lat, lng });
}

function estimateDurationMinutes(booking: {
  pricingType: PricingType;
  estimatedMinutes: number | null;
  estimatedAcres: number | null;
  estimatedTrips: number | null;
}): number {
  if (booking.pricingType === "hourly") {
    return Math.max(30, booking.estimatedMinutes ?? 60);
  }
  if (booking.pricingType === "acre") {
    return Math.max(60, Math.round((booking.estimatedAcres ?? 1) * 45));
  }
  return Math.max(60, (booking.estimatedTrips ?? 1) * 60);
}

function hasConflict(
  db: Database,
  tractorId: string,
  date: string,
  startTime: string,
  durationMinutes: number,
  ignoreBookingId?: string,
): Booking | null {
  const start = timeToMinutes(startTime);
  const end = start + durationMinutes;
  const blocking: BookingStatus[] = [
    "PENDING",
    "ACCEPTED",
    "SCHEDULED",
    "IN_PROGRESS",
    "PAUSED",
    "COMPLETION_PENDING",
    "BILL_GENERATED",
    "PAYMENT_PENDING",
  ];
  for (const booking of db.bookings) {
    if (booking.id === ignoreBookingId) continue;
    if (booking.tractorId !== tractorId) continue;
    if (booking.bookingDate !== date) continue;
    if (!blocking.includes(booking.status)) continue;
    const existingStart = timeToMinutes(booking.startTime);
    const existingEnd =
      existingStart + estimateDurationMinutes(booking);
    const buffer = 45;
    if (start < existingEnd + buffer && existingStart < end + buffer) {
      return booking;
    }
  }
  return null;
}

export async function createBooking(
  user: SessionUser,
  input: {
    tractorId: string;
    bookingFor: "self" | "other";
    recipientName?: string;
    recipientMobile?: string;
    serviceLocation: {
      label: string;
      village: string;
      district: string;
      state: string;
      lat: number;
      lng: number;
      note?: string;
    };
    serviceType: ServiceType;
    pricingType: PricingType;
    bookingDate: string;
    startTime: string;
    estimatedMinutes?: number;
    estimatedAcres?: number;
    estimatedTrips?: number;
    note?: string;
  },
): Promise<BookingDetail> {
  if (user.role !== "farmer") {
    throw new ServiceError("Only a farmer can create a booking.", 403);
  }
  const db = await getDb();
  const tractor = getTractor(db, input.tractorId);
  if (tractor.status !== "active") {
    throw new ServiceError("This tractor is not available for bookings.", 409);
  }
  const ownerProfile = getOwnerProfile(db, tractor.ownerId);
  if (!ownerProfile.online) {
    throw new ServiceError(
      "This tractor owner is currently offline. Please choose another tractor.",
      409,
    );
  }
  const pricing = getPricing(db, tractor.id);
  const enabled =
    input.pricingType === "hourly"
      ? pricing.hourlyEnabled
      : input.pricingType === "acre"
        ? pricing.acreEnabled
        : pricing.tripEnabled;
  if (!enabled) {
    throw new ServiceError(
      "This pricing option is not available for the selected tractor.",
      400,
    );
  }
  if (!SERVICES.some((service) => service.id === input.serviceType)) {
    throw new ServiceError("Please choose a valid service.", 400);
  }
  if (!input.bookingDate || input.bookingDate < todayISO()) {
    throw new ServiceError("Please choose today or a future date.", 400);
  }
  if (!/^\d{2}:\d{2}$/.test(input.startTime)) {
    throw new ServiceError("Please choose a valid start time.", 400);
  }
  if (input.bookingDate === todayISO()) {
    const chosen = timeToMinutes(input.startTime);
    const now = new Date();
    if (chosen < now.getHours() * 60 + now.getMinutes() + 30) {
      throw new ServiceError(
        "For today, please choose a start time at least 30 minutes from now.",
        400,
      );
    }
  }
  if (input.bookingFor === "other") {
    const recipientMobile = (input.recipientMobile ?? "").replace(/\D/g, "");
    if (!input.recipientName?.trim()) {
      throw new ServiceError("Please enter the recipient's name.", 400);
    }
    if (!/^[6-9]\d{9}$/.test(recipientMobile)) {
      throw new ServiceError("Please enter a valid 10-digit recipient mobile number.", 400);
    }
  }
  if (!input.serviceLocation?.label?.trim() || !input.serviceLocation?.village?.trim()) {
    throw new ServiceError("Please add the service location.", 400);
  }
  if (
    !Number.isFinite(input.serviceLocation.lat) ||
    !Number.isFinite(input.serviceLocation.lng)
  ) {
    throw new ServiceError("Please select a valid service location.", 400);
  }

  let minutes: number | null = null;
  let acres: number | null = null;
  let trips: number | null = null;
  if (input.pricingType === "hourly") {
    minutes = Math.round(Number(input.estimatedMinutes ?? 0));
    if (!Number.isFinite(minutes) || minutes < 30 || minutes > 12 * 60) {
      throw new ServiceError("Estimated time must be between 30 minutes and 12 hours.", 400);
    }
  }
  if (input.pricingType === "acre") {
    acres = Number(input.estimatedAcres ?? 0);
    if (!Number.isFinite(acres) || acres <= 0 || acres > 100) {
      throw new ServiceError("Please enter an acreage between 0 and 100.", 400);
    }
    acres = Math.round(acres * 10) / 10;
  }
  if (input.pricingType === "trip") {
    trips = Math.round(Number(input.estimatedTrips ?? 0));
    if (!Number.isFinite(trips) || trips < 1 || trips > 20) {
      throw new ServiceError("Please choose between 1 and 20 trips.", 400);
    }
  }

  const rate =
    input.pricingType === "hourly"
      ? pricing.hourlyRate
      : input.pricingType === "acre"
        ? pricing.acreRate
        : pricing.tripRate;
  const estimatedAmount = calculateAmount(input.pricingType, rate, {
    minutes,
    acres,
    trips,
  });
  const duration = estimateDurationMinutes({
    pricingType: input.pricingType,
    estimatedMinutes: minutes,
    estimatedAcres: acres,
    estimatedTrips: trips,
  });
  const conflict = hasConflict(
    db,
    tractor.id,
    input.bookingDate,
    input.startTime,
    duration,
  );
  if (conflict) {
    throw new ServiceError(
      `This tractor already has a booking around ${conflict.startTime} on that date. Please choose another time or date.`,
      409,
    );
  }

  const bookingId = await mutateDb((draft) => {
    const maxNumber = draft.bookings.reduce((max, b) => {
      const number = Number(b.id.replace("KT-", ""));
      return Number.isFinite(number) ? Math.max(max, number) : max;
    }, 1000);
    const id = `KT-${maxNumber + 1}`;
    const now = new Date().toISOString();
    const booking: Booking = {
      id,
      farmerId: user.id,
      tractorId: tractor.id,
      bookingFor: input.bookingFor,
      recipientName:
        input.bookingFor === "other" ? input.recipientName?.trim() ?? null : null,
      recipientMobile:
        input.bookingFor === "other"
          ? (input.recipientMobile ?? "").replace(/\D/g, "")
          : null,
      serviceLocation: {
        ...input.serviceLocation,
        note: input.serviceLocation.note?.slice(0, 300) ?? "",
      },
      serviceType: input.serviceType,
      pricingType: input.pricingType,
      agreedRate: rate,
      bookingDate: input.bookingDate,
      startTime: input.startTime,
      estimatedMinutes: minutes,
      estimatedAcres: acres,
      estimatedTrips: trips,
      estimatedAmount,
      finalAmount: null,
      status: "PENDING",
      note: input.note?.slice(0, 500) ?? "",
      createdAt: now,
      updatedAt: now,
      cancelledAt: null,
      cancellationReason: null,
      cancelledBy: null,
    };
    draft.bookings.push(booking);
    addHistory(
      draft,
      booking,
      null,
      "PENDING",
      user.id,
      "farmer",
      "Booking request sent",
    );
    notify(
      draft,
      tractor.ownerId,
      "New booking request",
      `${user.name} sent a ${booking.serviceType} request for ${booking.bookingDate} at ${booking.startTime}.`,
      "booking",
      id,
    );
    return id;
  });

  const fresh = await getDb();
  const booking = fresh.bookings.find((b) => b.id === bookingId)!;
  return buildBookingDetail(fresh, booking);
}

export type BookingAction =
  | "accept"
  | "reject"
  | "cancel"
  | "start"
  | "pause"
  | "resume"
  | "finish"
  | "record_payment"
  | "confirm_payment"
  | "share_location"
  | "dispute";

export function availableActions(
  role: Role | null,
  status: BookingStatus,
): BookingAction[] {
  if (!role) return [];
  if (role === "owner") {
    if (status === "PENDING") return ["accept", "reject", "cancel"];
    if (status === "ACCEPTED" || status === "SCHEDULED") return ["start", "cancel"];
    if (status === "IN_PROGRESS") return ["pause", "finish"];
    if (status === "PAUSED") return ["resume", "finish"];
    if (status === "PAYMENT_PENDING") return ["confirm_payment", "dispute"];
    if (status === "BILL_GENERATED") return ["dispute"];
    if (status === "PAID" || status === "COMPLETED") return ["dispute"];
    return [];
  }
  if (status === "PENDING") return ["cancel"];
  if (status === "ACCEPTED" || status === "SCHEDULED") {
    return ["share_location", "cancel"];
  }
  if (
    status === "IN_PROGRESS" ||
    status === "PAUSED" ||
    status === "COMPLETION_PENDING"
  ) {
    return ["share_location", "dispute"];
  }
  if (status === "BILL_GENERATED" || status === "PAYMENT_PENDING") {
    return ["dispute"];
  }
  if (status === "PAID" || status === "COMPLETED") return ["dispute"];
  return [];
}

export async function performBookingAction(input: {
  bookingId: string;
  user: SessionUser;
  action: BookingAction;
  payload?: {
    reason?: string;
    details?: string;
    acres?: number;
    trips?: number;
    method?: PaymentMethod;
    notes?: string;
    lat?: number;
    lng?: number;
    accuracy?: number;
    sharing?: boolean;
  };
}): Promise<BookingDetail> {
  const { bookingId, user, action, payload } = input;
  const db = await getDb();
  const existing = db.bookings.find((b) => b.id === bookingId);
  if (!existing) throw new ServiceError("Booking not found.", 404);
  const role = userRoleInBooking(db, existing, user.id);
  if (!role) throw new ServiceError("You do not have access to this booking.", 403);
  if (!availableActions(role, existing.status).includes(action)) {
    throw new ServiceError(
      `This action is not allowed while the booking is ${existing.status.toLowerCase().replaceAll("_", " ")}.`,
      409,
    );
  }
  const tractor = getTractor(db, existing.tractorId);
  const ownerProfile = getOwnerProfile(db, tractor.ownerId);

  await mutateDb((draft) => {
    const booking = draft.bookings.find((b) => b.id === bookingId);
    if (!booking) throw new ServiceError("Booking not found.", 404);
    if (booking.status !== existing.status) {
      throw new ServiceError(
        "This booking changed in the meantime. Refresh and try again.",
        409,
      );
    }
    const now = new Date();
    const nowIso = now.toISOString();
    const actorRole: Role = role;
    const farmer = draft.users.find((u) => u.id === booking.farmerId);
    const owner = draft.users.find((u) => u.id === tractor.ownerId);
    if (!farmer || !owner) throw new ServiceError("User record missing.", 500);

    switch (action) {
      case "accept": {
        if (role !== "owner") throw new ServiceError("Only the owner can accept.", 403);
        if (booking.status !== "PENDING") throw new ServiceError("This request is no longer pending.", 409);
        const conflict = hasConflict(
          draft,
          booking.tractorId,
          booking.bookingDate,
          booking.startTime,
          estimateDurationMinutes(booking),
          booking.id,
        );
        if (conflict) {
          throw new ServiceError(
            `You already have booking ${conflict.id} around this time. Reject this request or resolve the schedule first.`,
            409,
          );
        }
        changeStatus(
          draft,
          booking,
          "ACCEPTED",
          user.id,
          "owner",
          "Owner accepted the booking",
        );
        if (booking.bookingDate > todayISO()) {
          changeStatus(
            draft,
            booking,
            "SCHEDULED",
            "system",
            "system",
            "Booking scheduled for the agreed date",
          );
        }
        notify(
          draft,
          booking.farmerId,
          "Booking accepted",
          `${owner.name} accepted ${booking.id} for ${booking.bookingDate} at ${booking.startTime}.`,
          "booking",
          booking.id,
        );
        break;
      }
      case "reject": {
        if (role !== "owner") throw new ServiceError("Only the owner can reject.", 403);
        const reason = payload?.reason?.trim() || "Owner unavailable for this booking";
        changeStatus(
          draft,
          booking,
          "REJECTED",
          user.id,
          "owner",
          reason,
        );
        notify(
          draft,
          booking.farmerId,
          "Booking not accepted",
          `${owner.name} is unavailable for ${booking.id}. You can send a new request to another tractor.`,
          "booking",
          booking.id,
        );
        break;
      }
      case "cancel": {
        if (!CANCELLABLE_STATUSES.includes(booking.status)) {
          throw new ServiceError("This booking can no longer be cancelled normally.", 409);
        }
        const newStatus: BookingStatus =
          role === "farmer" ? "CANCELLED_BY_FARMER" : "CANCELLED_BY_OWNER";
        const reason = payload?.reason?.trim() || "Cancelled by user";
        booking.cancelledAt = nowIso;
        booking.cancellationReason = reason;
        booking.cancelledBy = user.id;
        changeStatus(draft, booking, newStatus, user.id, actorRole, reason);
        notify(
          draft,
          role === "farmer" ? tractor.ownerId : booking.farmerId,
          role === "farmer" ? "Farmer cancelled a booking" : "Owner cancelled a booking",
          role === "farmer"
            ? `${farmer.name} cancelled ${booking.id}.`
            : `${owner.name} cancelled ${booking.id}. Please book another nearby tractor if you still need help.`,
          "booking",
          booking.id,
        );
        break;
      }
      case "start": {
        if (role !== "owner") throw new ServiceError("Only the owner can start the job.", 403);
        if (!["ACCEPTED", "SCHEDULED"].includes(booking.status)) {
          throw new ServiceError("This job cannot be started now.", 409);
        }
        const session = ensureSession(draft, booking.id);
        if (session.segments.length === 0 || session.segments.at(-1)?.end) {
          session.segments.push({ start: nowIso, end: null });
        }
        booking.startTime = minutesToTime(now.getHours() * 60 + now.getMinutes());
        changeStatus(
          draft,
          booking,
          "IN_PROGRESS",
          user.id,
          "owner",
          "Owner started the job",
        );
        notify(
          draft,
          booking.farmerId,
          "Work started",
          `${owner.name} started work on ${booking.id}. Active work time is now being recorded.`,
          "work",
          booking.id,
        );
        break;
      }
      case "pause": {
        if (role !== "owner") throw new ServiceError("Only the owner can pause the job.", 403);
        if (booking.status !== "IN_PROGRESS") throw new ServiceError("Only active work can be paused.", 409);
        const session = ensureSession(draft, booking.id);
        closeOpenSegment(session, now);
        changeStatus(
          draft,
          booking,
          "PAUSED",
          user.id,
          "owner",
          payload?.reason?.trim() || "Work paused",
        );
        notify(
          draft,
          booking.farmerId,
          "Work paused",
          `${owner.name} paused work on ${booking.id}. Break time is recorded separately and not billed.`,
          "work",
          booking.id,
        );
        break;
      }
      case "resume": {
        if (role !== "owner") throw new ServiceError("Only the owner can resume the job.", 403);
        if (booking.status !== "PAUSED") throw new ServiceError("This job is not paused.", 409);
        const session = ensureSession(draft, booking.id);
        session.segments.push({ start: nowIso, end: null });
        changeStatus(
          draft,
          booking,
          "IN_PROGRESS",
          user.id,
          "owner",
          "Owner resumed work",
        );
        notify(
          draft,
          booking.farmerId,
          "Work resumed",
          `${owner.name} resumed work on ${booking.id}.`,
          "work",
          booking.id,
        );
        break;
      }
      case "finish": {
        if (role !== "owner") throw new ServiceError("Only the owner can finish the job.", 403);
        if (!["IN_PROGRESS", "PAUSED"].includes(booking.status)) {
          throw new ServiceError("This job cannot be finished from its current status.", 409);
        }
        const session = ensureSession(draft, booking.id);
        closeOpenSegment(session, now);
        session.totalMinutes = computeActiveMinutes(session.segments, now);
        if (booking.pricingType === "hourly" && session.totalMinutes < 1) {
          throw new ServiceError("At least one active minute is needed before finishing.", 409);
        }
        let completedAcres: number | null = null;
        let completedTrips: number | null = null;
        let billableMinutes: number | null = null;
        if (booking.pricingType === "hourly") {
          billableMinutes = Math.max(1, session.totalMinutes);
        } else if (booking.pricingType === "acre") {
          completedAcres = Math.round(Number(payload?.acres ?? 0) * 10) / 10;
          if (!Number.isFinite(completedAcres) || completedAcres <= 0 || completedAcres > 100) {
            throw new ServiceError("Enter the completed acreage before finishing.", 400);
          }
        } else {
          completedTrips = Math.round(Number(payload?.trips ?? 0));
          if (!Number.isFinite(completedTrips) || completedTrips < 1 || completedTrips > 20) {
            throw new ServiceError("Enter the number of completed trips before finishing.", 400);
          }
        }
        const finalAmount = calculateAmount(booking.pricingType, booking.agreedRate, {
          minutes: billableMinutes,
          acres: completedAcres,
          trips: completedTrips,
        });
        draft.workMeasurements = draft.workMeasurements.filter(
          (m) => m.bookingId !== booking.id,
        );
        draft.workMeasurements.push({
          bookingId: booking.id,
          completedAcres,
          completedTrips,
          billableMinutes,
          createdAt: nowIso,
        });
        booking.finalAmount = finalAmount;
        changeStatus(
          draft,
          booking,
          "COMPLETION_PENDING",
          user.id,
          "owner",
          "Work finished, final measurement recorded",
        );
        changeStatus(
          draft,
          booking,
          "BILL_GENERATED",
          "system",
          "system",
          "Final bill calculated",
        );
        changeStatus(
          draft,
          booking,
          "PAYMENT_PENDING",
          "system",
          "system",
          "Bill shared with farmer",
        );
        notify(
          draft,
          booking.farmerId,
          "Final bill ready",
          `Your final bill for ${booking.id} is ₹${finalAmount.toLocaleString("en-IN")}. Pay ${owner.name} directly.`,
          "payment",
          booking.id,
        );
        notify(
          draft,
          tractor.ownerId,
          "Final bill generated",
          `${booking.id} is ready for payment. The farmer will pay you directly.`,
          "payment",
          booking.id,
        );
        break;
      }
      case "record_payment": {
        // Payment is recorded only by the tractor owner, after the money reaches them.
        throw new ServiceError(
          "Only the tractor owner can mark payment done. Farmers pay the owner directly.",
          403,
        );
      }
      case "confirm_payment": {
        if (role !== "owner") throw new ServiceError("Only the owner can confirm payment.", 403);
        if (booking.status !== "PAYMENT_PENDING") {
          throw new ServiceError("Payment cannot be confirmed from this status.", 409);
        }
        if (!booking.finalAmount) throw new ServiceError("The final bill is missing.", 409);
        const existingPayment = draft.paymentRecords.find(
          (p) => p.bookingId === booking.id && p.paymentStatus !== "confirmed",
        );
        const method: PaymentMethod =
          payload?.method ?? existingPayment?.paymentMethod ?? ownerProfile.payment.preferredMethod;
        if (existingPayment) {
          existingPayment.paymentStatus = "confirmed";
          existingPayment.confirmedBy = user.id;
          existingPayment.confirmedAt = nowIso;
          existingPayment.amount = booking.finalAmount;
          existingPayment.paymentMethod = method;
        } else {
          draft.paymentRecords.push({
            id: `pay_${randomUUID()}`,
            bookingId: booking.id,
            amount: booking.finalAmount,
            paymentMethod: method,
            paymentStatus: "confirmed",
            recordedBy: user.id,
            paidAt: nowIso,
            confirmedBy: user.id,
            confirmedAt: nowIso,
            notes: payload?.notes?.slice(0, 300) ?? "Owner marked payment done after receiving the money.",
          });
        }
        changeStatus(
          draft,
          booking,
          "PAID",
          user.id,
          "owner",
          "Owner marked payment done",
        );
        notify(
          draft,
          booking.farmerId,
          "Payment marked done",
          `${owner.name} marked ₹${booking.finalAmount.toLocaleString("en-IN")} as received for ${booking.id}.`,
          "payment",
          booking.id,
        );
        changeStatus(
          draft,
          booking,
          "COMPLETED",
          "system",
          "system",
          "Booking completed",
        );
        notify(
          draft,
          booking.farmerId,
          "Booking completed",
          `${booking.id} is complete and saved in your booking history.`,
          "booking",
          booking.id,
        );
        break;
      }
      case "share_location": {
        if (role !== "farmer") {
          throw new ServiceError("Only the farmer can share the farm location.", 403);
        }
        const sharing = payload?.sharing !== false;
        if (!sharing) {
          booking.farmerLocation = null;
          notify(
            draft,
            tractor.ownerId,
            "Live location sharing stopped",
            `${farmer.name} stopped sharing their live location for ${booking.id}.`,
            "system",
            booking.id,
          );
          break;
        }
        const lat = Number(payload?.lat);
        const lng = Number(payload?.lng);
        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lng) ||
          lat < -90 ||
          lat > 90 ||
          lng < -180 ||
          lng > 180
        ) {
          throw new ServiceError("Please share a valid GPS location.", 400);
        }
        const wasSharing = booking.farmerLocation?.sharing === true;
        const accuracy = Number(payload?.accuracy);
        booking.farmerLocation = {
          lat: Math.round(lat * 100000) / 100000,
          lng: Math.round(lng * 100000) / 100000,
          accuracy:
            Number.isFinite(accuracy) && accuracy > 0
              ? Math.round(accuracy)
              : null,
          updatedAt: nowIso,
          sharing: true,
        };
        if (!wasSharing) {
          notify(
            draft,
            tractor.ownerId,
            "Farmer shared live location",
            `${farmer.name} is sharing their live location for ${booking.id}. Open the booking to see the map and directions.`,
            "system",
            booking.id,
          );
        }
        break;
      }
      case "dispute": {
        if (!["BILL_GENERATED", "PAYMENT_PENDING", "PAID", "COMPLETED"].includes(booking.status)) {
          throw new ServiceError("An issue can be reported after the final bill is ready.", 409);
        }
        if (booking.status === "COMPLETED") {
          const completedAt = new Date(booking.updatedAt).getTime();
          if (Date.now() - completedAt > 7 * 24 * 60 * 60 * 1000) {
            throw new ServiceError("The support window for this completed booking has passed.", 409);
          }
        }
        const reason = payload?.reason?.trim();
        const details = payload?.details?.trim();
        if (!reason || !details) {
          throw new ServiceError("Please add a reason and details for the issue.", 400);
        }
        const dispute: Dispute = {
          id: `disp_${randomUUID()}`,
          bookingId: booking.id,
          raisedBy: user.id,
          raisedByRole: role,
          reason: reason.slice(0, 120),
          details: details.slice(0, 1000),
          status: "open",
          createdAt: nowIso,
          resolvedAt: null,
        };
        draft.disputes.push(dispute);
        changeStatus(
          draft,
          booking,
          "DISPUTED",
          user.id,
          actorRole,
          reason.slice(0, 120),
        );
        notify(
          draft,
          role === "farmer" ? tractor.ownerId : booking.farmerId,
          "Issue reported",
          `An issue was reported on ${booking.id}. The original bill and work records are preserved.`,
          "system",
          booking.id,
        );
        break;
      }
    }
  });

  const fresh = await getDb();
  const booking = fresh.bookings.find((b) => b.id === bookingId)!;
  return buildBookingDetail(fresh, booking);
}

export async function getOwnerDashboard(userId: string): Promise<{
  tractorCount: number;
  newRequests: number;
  upcoming: number;
  completed: number;
  recordedEarnings: number;
  earnings: OwnerEarningsSummary;
  bookings: BookingDetail[];
}> {
  const bookings = await listBookingsForUser(userId);
  const ownerBookings = bookings.filter((b) => b.owner.id === userId);
  const db = await getDb();
  const ownerTractors = db.tractors.filter((t) => t.ownerId === userId);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const paidOn = (payment: { confirmedAt?: string | null; paidAt: string }) =>
    new Date(payment.confirmedAt ?? payment.paidAt);

  const confirmedRows = ownerBookings.flatMap((booking) =>
    booking.payments
      .filter((payment) => payment.paymentStatus === "confirmed")
      .map((payment) => ({ booking, payment })),
  );
  const sum = (rows: typeof confirmedRows) =>
    rows.reduce((total, row) => total + row.payment.amount, 0);

  const totalEarned = sum(confirmedRows);
  const thisMonthEarned = sum(
    confirmedRows.filter((row) => paidOn(row.payment) >= monthStart),
  );
  const lastMonthEarned = sum(
    confirmedRows.filter((row) => {
      const paidAt = paidOn(row.payment);
      return paidAt >= lastMonthStart && paidAt < monthStart;
    }),
  );
  const pendingAmount = ownerBookings
    .filter((booking) =>
      ["BILL_GENERATED", "PAYMENT_PENDING"].includes(booking.status),
    )
    .reduce(
      (total, booking) =>
        total + (booking.finalAmount ?? booking.estimatedAmount),
      0,
    );
  const completedJobs = ownerBookings.filter((booking) =>
    ["PAID", "COMPLETED"].includes(booking.status),
  ).length;

  const byTractor: TractorEarnings[] = ownerTractors
    .map((tractor) => {
      const tractorBookings = ownerBookings.filter(
        (booking) => booking.tractor.id === tractor.id,
      );
      const tractorConfirmed = confirmedRows.filter(
        (row) => row.booking.tractor.id === tractor.id,
      );
      const lastPaidAt = tractorConfirmed.reduce<string | null>(
        (latest, row) => {
          const paidAt = row.payment.confirmedAt ?? row.payment.paidAt;
          return !latest || paidAt > latest ? paidAt : latest;
        },
        null,
      );
      return {
        tractorId: tractor.id,
        brand: tractor.brand,
        model: tractor.model,
        registrationNumber: tractor.registrationNumber,
        image: tractor.image,
        total: sum(tractorConfirmed),
        thisMonth: sum(
          tractorConfirmed.filter((row) => paidOn(row.payment) >= monthStart),
        ),
        lastMonth: sum(
          tractorConfirmed.filter((row) => {
            const paidAt = paidOn(row.payment);
            return paidAt >= lastMonthStart && paidAt < monthStart;
          }),
        ),
        pending: tractorBookings
          .filter((booking) =>
            ["BILL_GENERATED", "PAYMENT_PENDING"].includes(booking.status),
          )
          .reduce(
            (total, booking) =>
              total + (booking.finalAmount ?? booking.estimatedAmount),
            0,
          ),
        completedJobs: tractorBookings.filter((booking) =>
          ["PAID", "COMPLETED"].includes(booking.status),
        ).length,
        lastPaidAt,
      };
    })
    .sort((a, b) => b.total - a.total || a.brand.localeCompare(b.brand));

  const recent: OwnerEarningRecord[] = ownerBookings
    .flatMap((booking) =>
      booking.payments.map((payment) => ({
        paymentId: payment.id,
        bookingId: booking.id,
        amount: payment.amount,
        paymentStatus: payment.paymentStatus,
        paymentMethod: payment.paymentMethod,
        paidAt: payment.paidAt,
        confirmedAt: payment.confirmedAt ?? null,
        farmerName: booking.farmer.name,
        tractorId: booking.tractor.id,
        tractorLabel: `${booking.tractor.brand} ${booking.tractor.model}`,
      })),
    )
    .sort((a, b) =>
      (b.confirmedAt ?? b.paidAt).localeCompare(a.confirmedAt ?? a.paidAt),
    )
    .slice(0, 10);

  return {
    tractorCount: db.tractors.filter(
      (t) => t.ownerId === userId && t.status === "active",
    ).length,
    newRequests: ownerBookings.filter((b) => b.status === "PENDING").length,
    upcoming: ownerBookings.filter((b) =>
      ["ACCEPTED", "SCHEDULED"].includes(b.status),
    ).length,
    completed: ownerBookings.filter((b) => b.status === "COMPLETED").length,
    recordedEarnings: thisMonthEarned,
    earnings: {
      total: totalEarned,
      thisMonth: thisMonthEarned,
      lastMonth: lastMonthEarned,
      pending: pendingAmount,
      confirmedPayments: confirmedRows.length,
      completedJobs,
      byTractor,
      recent,
    },
    bookings: ownerBookings,
  };
}

export async function updateOwnerOnlineStatus(
  userId: string,
  online: boolean,
): Promise<OwnerProfile> {
  return mutateDb((db) => {
    const profile = ensureOwnerProfile(db, userId);
    profile.online = Boolean(online);
    return profile;
  });
}

export async function updateOwnerPaymentDetails(
  userId: string,
  input: {
    shareUpi: boolean;
    upiId: string;
    shareQr: boolean;
    qrImage: string;
    shareBank: boolean;
    bankAccountName: string;
    bankAccountNumber: string;
    bankIfsc: string;
    preferredMethod: PaymentMethod;
  },
): Promise<OwnerProfile> {
  if (input.shareUpi && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(input.upiId.trim())) {
    throw new ServiceError("Please enter a valid UPI ID, for example owner@upi.", 400);
  }
  if (input.shareBank) {
    if (!input.bankAccountName.trim()) {
      throw new ServiceError("Please add the bank account holder name.", 400);
    }
    if (!/^\d{9,18}$/.test(input.bankAccountNumber.replace(/\s/g, ""))) {
      throw new ServiceError("Please enter a valid bank account number.", 400);
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(input.bankIfsc.trim().toUpperCase())) {
      throw new ServiceError("Please enter a valid IFSC code.", 400);
    }
  }
  return mutateDb((db) => {
    const profile = ensureOwnerProfile(db, userId);
    profile.payment = {
      shareUpi: Boolean(input.shareUpi),
      upiId: input.shareUpi ? input.upiId.trim() : "",
      shareQr: Boolean(input.shareQr),
      qrImage: input.shareQr ? input.qrImage : "",
      shareBank: Boolean(input.shareBank),
      bankAccountName: input.bankAccountName.trim(),
      bankAccountNumber: input.shareBank
        ? input.bankAccountNumber.replace(/\s/g, "")
        : "",
      bankIfsc: input.shareBank ? input.bankIfsc.trim().toUpperCase() : "",
      preferredMethod: input.preferredMethod,
    };
    return profile;
  });
}

export async function updateUserProfile(
  userId: string,
  input: {
    name?: string;
    preferredLanguage?: Language;
    village?: string;
    address?: string;
    pincode?: string;
    district?: string;
    state?: string;
    serviceRadiusKm?: number;
    lat?: number;
    lng?: number;
    documents?: {
      dlPhoto?: string | null;
      rcNumber?: string | null;
      rcPhoto?: string | null;
    };
  },
): Promise<SessionUser> {
  await mutateDb((db) => {
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new ServiceError("User not found.", 404);
    if (input.name !== undefined) {
      if (!input.name.trim() || input.name.trim().length < 2) {
        throw new ServiceError("Please enter a valid name.", 400);
      }
      user.name = input.name.trim().slice(0, 80);
    }
    if (input.preferredLanguage) {
      if (!LANGUAGES.some((item) => item.code === input.preferredLanguage)) {
        throw new ServiceError("That language is not supported yet.", 400);
      }
      user.preferredLanguage = input.preferredLanguage;
    }
    const farmerProfile = db.farmerProfiles.find((p) => p.userId === userId);
    const ownerProfile = db.ownerProfiles.find((p) => p.userId === userId);
    const profile =
      user.role === "owner"
        ? (ownerProfile ?? ensureOwnerProfile(db, userId))
        : (farmerProfile ?? ensureFarmerProfile(db, userId));
    if (profile) {
      if (input.village !== undefined) {
        const village = input.village.trim().slice(0, 80);
        if (!village) {
          throw new ServiceError("Please enter your village name.", 400);
        }
        profile.village = village;
      }
      if (input.address !== undefined) profile.address = input.address.trim();
      if (input.pincode !== undefined) profile.pincode = input.pincode.trim();
      if (input.district !== undefined) profile.district = input.district.trim();
      if (input.state !== undefined) profile.state = input.state.trim();
      if (input.lat !== undefined) {
        if (!Number.isFinite(input.lat) || input.lat < -90 || input.lat > 90) {
          throw new ServiceError("Please provide a valid latitude.", 400);
        }
        profile.lat = input.lat;
      }
      if (input.lng !== undefined) {
        if (!Number.isFinite(input.lng) || input.lng < -180 || input.lng > 180) {
          throw new ServiceError("Please provide a valid longitude.", 400);
        }
        profile.lng = input.lng;
      }
      // Document verification is an owner-only feature. Ignore the field for
      // farmers so a stale client or direct API call cannot store documents on
      // a farmer profile.
      if (input.documents && (ownerProfile || user.role === "owner")) {
        const docs: UserDocuments = profile.documents ?? {
          dlStatus: "not_provided",
          rcStatus: "not_provided",
        };
        const cleanUpload = (value: string | null | undefined, label: string) => {
          const trimmed = (value ?? "").trim();
          if (!trimmed) return "";
          const isPrivateFile =
            /^\/api\/files\/app-documents\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(
              trimmed,
            );
          const isPublicFile =
            !trimmed.startsWith("/api/files/") &&
            (trimmed.startsWith("/uploads/") ||
              trimmed.startsWith("http://") ||
              trimmed.startsWith("https://") ||
              trimmed.startsWith("data:image/"));
          if (!isPrivateFile && !isPublicFile) {
            throw new ServiceError(`Please upload a valid ${label} image.`, 400);
          }
          return trimmed;
        };
        if (input.documents.dlPhoto !== undefined) {
          const photo = cleanUpload(input.documents.dlPhoto, "driving licence");
          docs.dlPhoto = photo || undefined;
          docs.dlStatus = photo ? "verified" : "not_provided";
        }
        if (input.documents.rcPhoto !== undefined) {
          const photo = cleanUpload(input.documents.rcPhoto, "RC");
          docs.rcPhoto = photo || undefined;
        }
        if (input.documents.rcNumber !== undefined) {
          const rcNumber = (input.documents.rcNumber ?? "").trim().toUpperCase();
          if (
            rcNumber &&
            !/^[A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,3}\s?\d{3,4}$/i.test(rcNumber)
          ) {
            throw new ServiceError(
              "Enter a valid RC number, for example MH 15 AB 1234.",
              400,
            );
          }
          docs.rcNumber = rcNumber || undefined;
        }
        docs.rcStatus = docs.rcNumber || docs.rcPhoto ? "verified" : "not_provided";
        docs.updatedAt = new Date().toISOString();
        profile.documents = docs;
      }
    }
    if (ownerProfile && input.serviceRadiusKm !== undefined) {
      if (input.serviceRadiusKm < 1 || input.serviceRadiusKm > 50) {
        throw new ServiceError("Service radius must be between 1 and 50 km.", 400);
      }
      ownerProfile.serviceRadiusKm = input.serviceRadiusKm;
    }
  });
  const db = await getDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new ServiceError("User not found.", 404);
  return {
    ...user,
    farmerProfile: db.farmerProfiles.find((p) => p.userId === userId),
    ownerProfile: db.ownerProfiles.find((p) => p.userId === userId),
  };
}

export async function saveTractor(
  userId: string,
  input: {
    id?: string;
    brand: string;
    model: string;
    registrationNumber: string;
    horsepower: number;
    manufacturingYear: number;
    image?: string;
    images?: string[];
    status?: "active" | "maintenance" | "inactive";
    village: string;
    district: string;
    state: string;
    lat: number;
    lng: number;
    serviceRadiusKm: number;
    equipmentIds: string[];
    hourlyEnabled: boolean;
    hourlyRate: number;
    acreEnabled: boolean;
    acreRate: number;
    tripEnabled: boolean;
    tripRate: number;
  },
): Promise<Tractor> {
  if (!input.brand.trim() || !input.model.trim()) {
    throw new ServiceError("Please add the tractor brand and model.", 400);
  }
  if (!/^[A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,3}\s?\d{3,4}$/i.test(input.registrationNumber.trim())) {
    throw new ServiceError("Please enter a valid registration number, for example MH 15 GT 4821.", 400);
  }
  if (!input.hourlyEnabled && !input.acreEnabled && !input.tripEnabled) {
    throw new ServiceError("Enable at least one pricing option.", 400);
  }
  const rates = [input.hourlyRate, input.acreRate, input.tripRate];
  if (rates.some((rate) => rate !== 0 && (!Number.isFinite(rate) || rate < 0 || rate > 100000))) {
    throw new ServiceError("Please enter valid rates.", 400);
  }
  if (
    input.hourlyEnabled &&
    (!Number.isFinite(input.hourlyRate) || input.hourlyRate < 1)
  ) {
    throw new ServiceError("Please add an hourly rate.", 400);
  }
  if (input.acreEnabled && (!Number.isFinite(input.acreRate) || input.acreRate < 1)) {
    throw new ServiceError("Please add a per-acre rate.", 400);
  }
  if (input.tripEnabled && (!Number.isFinite(input.tripRate) || input.tripRate < 1)) {
    throw new ServiceError("Please add a per-trip rate.", 400);
  }
  if (!input.equipmentIds.length) {
    throw new ServiceError("Please select at least one equipment.", 400);
  }
  return mutateDb((db) => {
    const ownerProfile = ensureOwnerProfile(db, userId);
    let tractor: Tractor;
    if (input.id) {
      const found = db.tractors.find(
        (t) => t.id === input.id && t.ownerId === userId,
      );
      if (!found) throw new ServiceError("Tractor not found.", 404);
      tractor = found;
    } else {
      tractor = {
        id: `tr_${randomUUID()}`,
        ownerId: userId,
        brand: "",
        model: "",
        registrationNumber: "",
        horsepower: 50,
        manufacturingYear: new Date().getFullYear(),
        image: PHOTOS.tractorIndia,
        images: [],
        status: "active",
        village: "",
        district: "",
        state: "",
        lat: 0,
        lng: 0,
        serviceRadiusKm: 10,
        equipmentIds: [],
        createdAt: new Date().toISOString(),
      };
      db.tractors.push(tractor);
    }
    tractor.brand = input.brand.trim();
    tractor.model = input.model.trim();
    tractor.registrationNumber = input.registrationNumber.trim().toUpperCase();
    tractor.horsepower = Number(input.horsepower) || 50;
    tractor.manufacturingYear = Number(input.manufacturingYear) || new Date().getFullYear();
    tractor.image = input.image || tractor.image || PHOTOS.tractorIndia;
    tractor.images = input.images?.length ? input.images : [tractor.image];
    tractor.status = input.status ?? "active";
    const tractorVillage = (input.village ?? "").trim() || (ownerProfile.village ?? "").trim();
    if (!tractorVillage) {
      throw new ServiceError("Please enter the tractor's village.", 400);
    }
    tractor.village = tractorVillage;
    tractor.district = input.district || ownerProfile.district;
    tractor.state = input.state || ownerProfile.state;
    tractor.lat = Number.isFinite(input.lat) ? input.lat : ownerProfile.lat;
    tractor.lng = Number.isFinite(input.lng) ? input.lng : ownerProfile.lng;
    tractor.serviceRadiusKm = input.serviceRadiusKm || 10;
    tractor.equipmentIds = input.equipmentIds;
    const existingPricing = db.pricing.find((p) => p.tractorId === tractor.id);
    const pricing = existingPricing ?? {
      tractorId: tractor.id,
      hourlyEnabled: false,
      hourlyRate: 0,
      acreEnabled: false,
      acreRate: 0,
      tripEnabled: false,
      tripRate: 0,
    };
    pricing.hourlyEnabled = input.hourlyEnabled;
    pricing.hourlyRate = Math.round(input.hourlyRate) || 0;
    pricing.acreEnabled = input.acreEnabled;
    pricing.acreRate = Math.round(input.acreRate) || 0;
    pricing.tripEnabled = input.tripEnabled;
    pricing.tripRate = Math.round(input.tripRate) || 0;
    if (!existingPricing) db.pricing.push(pricing);
    return tractor;
  });
}

export async function deleteTractor(userId: string, tractorId: string) {
  await mutateDb((db) => {
    const tractor = db.tractors.find(
      (t) => t.id === tractorId && t.ownerId === userId,
    );
    if (!tractor) throw new ServiceError("Tractor not found.", 404);
    const active = db.bookings.some(
      (b) =>
        b.tractorId === tractorId &&
        !TERMINAL_STATUSES.includes(b.status) &&
        b.status !== "PENDING",
    );
    if (active) {
      throw new ServiceError(
        "This tractor has active or upcoming bookings. Complete or cancel them before removing it.",
        409,
      );
    }
    db.tractors = db.tractors.filter((t) => t.id !== tractorId);
    db.pricing = db.pricing.filter((p) => p.tractorId !== tractorId);
  });
}

export async function getTractorDetail(
  tractorId: string,
  userId?: string,
): Promise<TractorWithOwner> {
  const db = await getDb();
  const rows = listTractors(db, { ownerId: undefined, onlineOnly: false });
  const tractor = rows.find((t) => t.id === tractorId);
  if (!tractor) throw new ServiceError("Tractor not found.", 404);
  if (userId) {
    const user = db.users.find((u) => u.id === userId);
    if (user) {
      const profile =
        db.farmerProfiles.find((p) => p.userId === userId) ??
        db.ownerProfiles.find((p) => p.userId === userId);
      if (profile) {
        tractor.distanceKm = haversineKm(profile, tractor);
      }
    }
  }
  return tractor;
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const db = await getDb();
  return db.notifications.filter((n) => n.userId === userId && !n.read).length;
}

export async function listNotifications(userId: string) {
  const db = await getDb();
  return db.notifications
    .filter((n) => n.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 50);
}

export async function markNotificationsRead(userId: string, ids?: string[]) {
  await mutateDb((db) => {
    for (const notification of db.notifications) {
      if (notification.userId !== userId) continue;
      if (!ids || ids.includes(notification.id)) notification.read = true;
    }
  });
}
