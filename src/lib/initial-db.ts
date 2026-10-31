import { EQUIPMENT_CATALOG } from "./constants";
import type { Database } from "./types";

/**
 * A brand-new installation has no accounts, tractors or bookings. Equipment is
 * reference data (plough, rotavator, trolley, ...), not sample content.
 */
export function buildInitialDatabase(): Database {
  return {
    users: [],
    farmerProfiles: [],
    ownerProfiles: [],
    tractors: [],
    equipment: EQUIPMENT_CATALOG,
    pricing: [],
    bookings: [],
    workSessions: [],
    workMeasurements: [],
    paymentRecords: [],
    bookingStatusHistory: [],
    notifications: [],
    disputes: [],
    sessions: [],
    otpChallenges: [],
  };
}
