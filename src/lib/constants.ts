import type {
  BookingStatus,
  Equipment,
  Language,
  PaymentMethod,
  PricingType,
  Role,
  ServiceType,
} from "./types";

export const APP_NAME = "KisanTractor";

export const PHOTOS = {
  heroTractor:
    "https://images.pexels.com/photos/12499940/pexels-photo-12499940.jpeg?auto=compress&cs=tinysrgb&w=1800",
  tractorIndia:
    "https://images.pexels.com/photos/18135422/pexels-photo-18135422.jpeg?auto=compress&cs=tinysrgb&w=1400",
  tractorGreen:
    "https://images.pexels.com/photos/2253413/pexels-photo-2253413.jpeg?auto=compress&cs=tinysrgb&w=1400",
  tractorTrailer:
    "https://images.pexels.com/photos/14242191/pexels-photo-14242191.jpeg?auto=compress&cs=tinysrgb&w=1400",
  ploughing:
    "https://images.pexels.com/photos/12499939/pexels-photo-12499939.jpeg?auto=compress&cs=tinysrgb&w=1400",
  fieldAerial:
    "https://images.pexels.com/photos/12486434/pexels-photo-12486434.jpeg?auto=compress&cs=tinysrgb&w=1600",
  harvest:
    "https://images.pexels.com/photos/2257304/pexels-photo-2257304.jpeg?auto=compress&cs=tinysrgb&w=1400",
  ownerDriver:
    "https://images.pexels.com/photos/2252618/pexels-photo-2252618.jpeg?auto=compress&cs=tinysrgb&w=1400",
} as const;

/**
 * All 22 languages in the Eighth Schedule of the Indian Constitution,
 * plus English. Missing translations fall back to English.
 */
export const LANGUAGES: { code: Language; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "mr", label: "Marathi", native: "मराठी" },
  { code: "as", label: "Assamese", native: "অসমীয়া" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
  { code: "brx", label: "Bodo", native: "बड़ो" },
  { code: "doi", label: "Dogri", native: "डोगरी" },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ks", label: "Kashmiri", native: "کٲشُر" },
  { code: "kok", label: "Konkani", native: "कोंकणी" },
  { code: "mai", label: "Maithili", native: "मैथिली" },
  { code: "ml", label: "Malayalam", native: "മലയാളം" },
  { code: "mni", label: "Manipuri", native: "মৈতৈলোন্" },
  { code: "ne", label: "Nepali", native: "नेपाली" },
  { code: "or", label: "Odia", native: "ଓଡ଼ିଆ" },
  { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "sa", label: "Sanskrit", native: "संस्कृतम्" },
  { code: "sat", label: "Santali", native: "ᱥᱟᱱᱛᱟᱲᱤ" },
  { code: "sd", label: "Sindhi", native: "سنڌي" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "ur", label: "Urdu", native: "اردو" },
];

export const RTL_LANGUAGES: Language[] = ["ks", "sd", "ur"];

export const LANGUAGE_LOCALES: Record<Language, string> = {
  en: "en-IN",
  hi: "hi-IN",
  mr: "mr-IN",
  as: "as-IN",
  bn: "bn-IN",
  brx: "brx-IN",
  doi: "doi-IN",
  gu: "gu-IN",
  kn: "kn-IN",
  ks: "ks-IN",
  kok: "kok-IN",
  mai: "mai-IN",
  ml: "ml-IN",
  mni: "mni-IN",
  ne: "ne-IN",
  or: "or-IN",
  pa: "pa-IN",
  sa: "sa-IN",
  sat: "sat-IN",
  sd: "sd-IN",
  ta: "ta-IN",
  te: "te-IN",
  ur: "ur-IN",
};

export const SERVICES: {
  id: ServiceType;
  name: string;
  native: Partial<Record<Language, string>>;
  short: string;
  description: string;
  image: string;
  icon: string;
  unitHint: string;
}[] = [
  {
    id: "ploughing",
    name: "Ploughing",
    native: { en: "Ploughing", hi: "जुताई", mr: "नांगरणी" },
    short: "Turn the soil. Prepare for a new season.",
    description:
      "Deep ploughing to turn the soil, break hardpan and prepare your field for sowing.",
    image: PHOTOS.ploughing,
    icon: "plough",
    unitHint: "Hourly or per acre",
  },
  {
    id: "rotavation",
    name: "Rotavator",
    native: { en: "Rotavator", hi: "रोटावेटर", mr: "रोटाव्हेटर" },
    short: "A finer seedbed, ready for sowing.",
    description:
      "Rotavation breaks clods into a fine tilth so seed meets soil evenly.",
    image: PHOTOS.tractorGreen,
    icon: "rotavator",
    unitHint: "Per acre",
  },
  {
    id: "trolley",
    name: "Trolley transport",
    native: { en: "Trolley transport", hi: "ट्रॉली परिवहन", mr: "ट्रॉली वाहतूक" },
    short: "Move crops, manure and farm supplies.",
    description:
      "Local trolley transport for harvest, manure, fodder and farm supplies.",
    image: PHOTOS.tractorTrailer,
    icon: "trolley",
    unitHint: "Per trip",
  },
];

export const EQUIPMENT_CATALOG: Equipment[] = [
  {
    id: "eq_plough",
    name: "Plough",
    description: "Mouldboard plough for deep soil turning",
    icon: "plough",
  },
  {
    id: "eq_rotavator",
    name: "Rotavator",
    description: "Fine seedbed preparation",
    icon: "rotavator",
  },
  {
    id: "eq_trolley",
    name: "Trolley",
    description: "Local transport for harvest and supplies",
    icon: "trolley",
  },
  {
    id: "eq_seed_drill",
    name: "Seed drill",
    description: "Even row sowing",
    icon: "seed",
  },
  {
    id: "eq_sprayer",
    name: "Sprayer",
    description: "Field spraying equipment",
    icon: "spray",
  },
];

export const VILLAGES = [
  {
    name: "Niphad",
    district: "Nashik",
    state: "Maharashtra",
    lat: 20.0833,
    lng: 73.9333,
  },
  {
    name: "Pimpalgaon Baswant",
    district: "Nashik",
    state: "Maharashtra",
    lat: 20.1667,
    lng: 73.9833,
  },
  {
    name: "Ozar",
    district: "Nashik",
    state: "Maharashtra",
    lat: 20.1,
    lng: 73.9333,
  },
  {
    name: "Lasalgaon",
    district: "Nashik",
    state: "Maharashtra",
    lat: 20.15,
    lng: 74.2333,
  },
  {
    name: "Sinnar",
    district: "Nashik",
    state: "Maharashtra",
    lat: 19.845,
    lng: 73.995,
  },
  {
    name: "Yeola",
    district: "Nashik",
    state: "Maharashtra",
    lat: 20.033,
    lng: 74.483,
  },
  {
    name: "Chandwad",
    district: "Nashik",
    state: "Maharashtra",
    lat: 20.333,
    lng: 74.25,
  },
  {
    name: "Dindori",
    district: "Nashik",
    state: "Maharashtra",
    lat: 20.2,
    lng: 73.833,
  },
];

export const PAYMENT_METHODS: {
  id: PaymentMethod;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    id: "upi",
    label: "UPI",
    description: "Pay using your own UPI app",
    icon: "upi",
  },
  {
    id: "cash",
    label: "Cash",
    description: "Hand cash directly to the owner",
    icon: "cash",
  },
  {
    id: "bank",
    label: "Bank transfer",
    description: "Transfer using your bank",
    icon: "bank",
  },
  {
    id: "other",
    label: "Other agreed method",
    description: "As agreed between you and the owner",
    icon: "other",
  },
];

export const STATUS_META: Record<
  BookingStatus,
  {
    label: string;
    ownerLabel: string;
    tone: "amber" | "green" | "blue" | "clay" | "stone" | "red";
    step: number;
    hint: string;
  }
> = {
  PENDING: {
    label: "Waiting for confirmation",
    ownerLabel: "New booking request",
    tone: "amber",
    step: 1,
    hint: "Only the tractor owner can accept this request.",
  },
  ACCEPTED: {
    label: "Booking accepted",
    ownerLabel: "Booking confirmed",
    tone: "green",
    step: 2,
    hint: "The owner will start work when they arrive.",
  },
  SCHEDULED: {
    label: "Upcoming booking",
    ownerLabel: "Upcoming job",
    tone: "green",
    step: 2,
    hint: "Your time is scheduled. Work has not started yet.",
  },
  IN_PROGRESS: {
    label: "Work in progress",
    ownerLabel: "Job started",
    tone: "blue",
    step: 3,
    hint: "Only active work time is billed.",
  },
  PAUSED: {
    label: "Work temporarily paused",
    ownerLabel: "Job paused",
    tone: "clay",
    step: 3,
    hint: "Break time is recorded separately and not billed.",
  },
  COMPLETION_PENDING: {
    label: "Preparing final bill",
    ownerLabel: "Work finished",
    tone: "amber",
    step: 4,
    hint: "The owner is confirming the final work measurement.",
  },
  BILL_GENERATED: {
    label: "Final bill ready",
    ownerLabel: "Bill generated",
    tone: "amber",
    step: 5,
    hint: "Review the bill and pay the owner directly.",
  },
  PAYMENT_PENDING: {
    label: "Payment due to tractor owner",
    ownerLabel: "Awaiting payment",
    tone: "clay",
    step: 5,
    hint: "Pay the owner directly, outside KisanTractor. The owner marks the payment done after receiving it.",
  },
  PAID: {
    label: "Payment confirmed",
    ownerLabel: "Payment received",
    tone: "green",
    step: 6,
    hint: "The tractor owner marked the payment done.",
  },
  COMPLETED: {
    label: "Booking completed",
    ownerLabel: "Job completed",
    tone: "green",
    step: 7,
    hint: "This booking is saved in your history.",
  },
  REJECTED: {
    label: "Booking not accepted",
    ownerLabel: "Request rejected",
    tone: "stone",
    step: 0,
    hint: "The owner was unavailable for this request.",
  },
  CANCELLED_BY_FARMER: {
    label: "Booking cancelled",
    ownerLabel: "Cancelled by farmer",
    tone: "stone",
    step: 0,
    hint: "This booking was cancelled by the farmer.",
  },
  CANCELLED_BY_OWNER: {
    label: "Booking cancelled",
    ownerLabel: "Cancelled by owner",
    tone: "stone",
    step: 0,
    hint: "This booking was cancelled by the tractor owner.",
  },
  EXPIRED: {
    label: "Booking expired",
    ownerLabel: "Request expired",
    tone: "stone",
    step: 0,
    hint: "The owner did not respond in time. You can book again.",
  },
  DISPUTED: {
    label: "Issue under review",
    ownerLabel: "Issue under review",
    tone: "red",
    step: 5,
    hint: "The original bill and work records have been preserved.",
  },
};

export const ACTIVE_STATUSES: BookingStatus[] = [
  "PENDING",
  "ACCEPTED",
  "SCHEDULED",
  "IN_PROGRESS",
  "PAUSED",
  "COMPLETION_PENDING",
  "BILL_GENERATED",
  "PAYMENT_PENDING",
  "PAID",
];

export const TERMINAL_STATUSES: BookingStatus[] = [
  "COMPLETED",
  "REJECTED",
  "CANCELLED_BY_FARMER",
  "CANCELLED_BY_OWNER",
  "EXPIRED",
];

export const CANCELLABLE_STATUSES: BookingStatus[] = [
  "PENDING",
  "ACCEPTED",
  "SCHEDULED",
];

export const ROLE_LABELS: Record<Role, string> = {
  farmer: "Farmer",
  owner: "Tractor Owner",
};

export const PRICING_LABELS: Record<PricingType, string> = {
  hourly: "Hourly",
  acre: "Per acre",
  trip: "Per trip",
};

export const PRICING_UNITS: Record<PricingType, string> = {
  hourly: "/ hour",
  acre: "/ acre",
  trip: "/ trip",
};
