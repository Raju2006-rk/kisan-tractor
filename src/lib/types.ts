export type Role = "farmer" | "owner";

export type Language =
  | "en"
  | "hi"
  | "mr"
  | "as"
  | "bn"
  | "brx"
  | "doi"
  | "gu"
  | "kn"
  | "ks"
  | "kok"
  | "mai"
  | "ml"
  | "mni"
  | "ne"
  | "or"
  | "pa"
  | "sa"
  | "sat"
  | "sd"
  | "ta"
  | "te"
  | "ur";

export type PricingType = "hourly" | "acre" | "trip";

export type ServiceType = "ploughing" | "rotavation" | "trolley";

export type BookingStatus =
  | "PENDING"
  | "ACCEPTED"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "PAUSED"
  | "COMPLETION_PENDING"
  | "BILL_GENERATED"
  | "PAYMENT_PENDING"
  | "PAID"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED_BY_FARMER"
  | "CANCELLED_BY_OWNER"
  | "EXPIRED"
  | "DISPUTED";

export type PaymentMethod = "upi" | "cash" | "bank" | "other";

export type PaymentStatus = "recorded" | "confirmed" | "disputed";

export type User = {
  id: string;
  name: string;
  mobile: string;
  role: Role;
  preferredLanguage: Language;
  profilePhoto?: string | null;
  createdAt: string;
};

export type DocumentStatus = "not_provided" | "verified";

export type UserDocuments = {
  dlPhoto?: string;
  dlStatus: DocumentStatus;
  rcNumber?: string;
  rcPhoto?: string;
  rcStatus: DocumentStatus;
  updatedAt?: string;
};

export type FarmerProfile = {
  userId: string;
  address: string;
  village: string;
  district: string;
  state: string;
  pincode?: string;
  lat: number;
  lng: number;
  documents?: UserDocuments;
};

export type OwnerPaymentDetails = {
  shareUpi: boolean;
  upiId: string;
  shareQr: boolean;
  qrImage: string;
  shareBank: boolean;
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  preferredMethod: PaymentMethod;
};

export type OwnerProfile = {
  userId: string;
  address: string;
  village: string;
  district: string;
  state: string;
  pincode?: string;
  lat: number;
  lng: number;
  online: boolean;
  serviceRadiusKm: number;
  payment: OwnerPaymentDetails;
  documents?: UserDocuments;
};

export type Equipment = {
  id: string;
  name: string;
  description: string;
  icon: string;
};

export type Tractor = {
  id: string;
  ownerId: string;
  brand: string;
  model: string;
  registrationNumber: string;
  horsepower: number;
  manufacturingYear: number;
  image: string;
  images: string[];
  status: "active" | "maintenance" | "inactive";
  village: string;
  district: string;
  state: string;
  lat: number;
  lng: number;
  serviceRadiusKm: number;
  equipmentIds: string[];
  createdAt: string;
};

export type Pricing = {
  tractorId: string;
  hourlyEnabled: boolean;
  hourlyRate: number;
  acreEnabled: boolean;
  acreRate: number;
  tripEnabled: boolean;
  tripRate: number;
};

export type BookingFor = "self" | "other";

export type LiveLocation = {
  lat: number;
  lng: number;
  accuracy: number | null;
  updatedAt: string;
  sharing: boolean;
};

export type BookingLocation = {
  label: string;
  village: string;
  district: string;
  state: string;
  lat: number;
  lng: number;
  note?: string;
};

export type Booking = {
  id: string;
  farmerId: string;
  tractorId: string;
  bookingFor: BookingFor;
  recipientName: string | null;
  recipientMobile: string | null;
  serviceLocation: BookingLocation;
  serviceType: ServiceType;
  pricingType: PricingType;
  agreedRate: number;
  bookingDate: string;
  startTime: string;
  estimatedMinutes: number | null;
  estimatedAcres: number | null;
  estimatedTrips: number | null;
  estimatedAmount: number;
  finalAmount: number | null;
  status: BookingStatus;
  note: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  cancelledBy?: string | null;
  /** Farmer-shared live GPS position for this booking, if sharing is on. */
  farmerLocation?: LiveLocation | null;
};

export type WorkSegment = {
  start: string;
  end: string | null;
};

export type WorkSession = {
  id: string;
  bookingId: string;
  segments: WorkSegment[];
  totalMinutes: number;
  createdAt: string;
};

export type WorkMeasurement = {
  bookingId: string;
  completedAcres: number | null;
  completedTrips: number | null;
  billableMinutes: number | null;
  createdAt: string;
};

export type PaymentRecord = {
  id: string;
  bookingId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  recordedBy: string;
  paidAt: string;
  confirmedBy?: string | null;
  confirmedAt?: string | null;
  notes: string;
};

export type StatusHistory = {
  id: string;
  bookingId: string;
  oldStatus: BookingStatus | null;
  newStatus: BookingStatus;
  changedBy: string;
  changedByRole: Role | "system";
  reason: string;
  createdAt: string;
};

export type Notification = {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: "booking" | "payment" | "work" | "system";
  bookingId?: string | null;
  read: boolean;
  createdAt: string;
};

export type Dispute = {
  id: string;
  bookingId: string;
  raisedBy: string;
  raisedByRole: Role;
  reason: string;
  details: string;
  status: "open" | "resolved";
  createdAt: string;
  resolvedAt?: string | null;
};

export type Session = {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

export type OtpChallenge = {
  id: string;
  mobile: string;
  otp: string;
  role: Role | null;
  expiresAt: string;
  createdAt: string;
};

export type Database = {
  users: User[];
  farmerProfiles: FarmerProfile[];
  ownerProfiles: OwnerProfile[];
  tractors: Tractor[];
  equipment: Equipment[];
  pricing: Pricing[];
  bookings: Booking[];
  workSessions: WorkSession[];
  workMeasurements: WorkMeasurement[];
  paymentRecords: PaymentRecord[];
  bookingStatusHistory: StatusHistory[];
  notifications: Notification[];
  disputes: Dispute[];
  sessions: Session[];
  otpChallenges: OtpChallenge[];
};

export type TractorWithOwner = Tractor & {
  owner: Pick<User, "id" | "name" | "mobile">;
  ownerProfile: OwnerProfile;
  pricing: Pricing;
  equipment: Equipment[];
  distanceKm: number;
  isAvailable: boolean;
};

export type BookingDetail = Booking & {
  farmer: User;
  owner: User;
  ownerProfile: OwnerProfile;
  tractor: Tractor;
  pricing: Pricing;
  workSession: WorkSession | null;
  measurement: WorkMeasurement | null;
  payments: PaymentRecord[];
  history: StatusHistory[];
  dispute: Dispute | null;
  canReview: boolean;
};

export type SessionUser = User & {
  farmerProfile?: FarmerProfile;
  ownerProfile?: OwnerProfile;
};
