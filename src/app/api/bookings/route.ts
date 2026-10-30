import { NextResponse } from "next/server";
import {
  createBooking,
  listBookingsForUser,
} from "@/lib/booking-service";
import { handleApiError, jsonError, readJson, requireUser } from "@/lib/http";
import type { BookingFor, PricingType, ServiceType } from "@/lib/types";

export async function GET() {
  try {
    const user = await requireUser();
    const bookings = await listBookingsForUser(user.id);
    return NextResponse.json({ bookings });
  } catch (error) {
    return handleApiError(error);
  }
}

type CreateBody = {
  tractorId?: string;
  bookingFor?: BookingFor;
  recipientName?: string;
  recipientMobile?: string;
  serviceLocation?: {
    label: string;
    village: string;
    district: string;
    state: string;
    lat: number;
    lng: number;
    note?: string;
  };
  serviceType?: ServiceType;
  pricingType?: PricingType;
  bookingDate?: string;
  startTime?: string;
  estimatedMinutes?: number;
  estimatedAcres?: number;
  estimatedTrips?: number;
  note?: string;
};

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "farmer") {
      return jsonError("Only a farmer can create a booking.", 403);
    }
    const body = await readJson<CreateBody>(request);
    if (
      !body.tractorId ||
      !body.serviceLocation ||
      !body.serviceType ||
      !body.pricingType ||
      !body.bookingDate ||
      !body.startTime
    ) {
      return jsonError("Please complete the booking details.", 400);
    }
    const booking = await createBooking(user, {
      tractorId: body.tractorId,
      bookingFor: body.bookingFor === "other" ? "other" : "self",
      recipientName: body.recipientName,
      recipientMobile: body.recipientMobile,
      serviceLocation: body.serviceLocation,
      serviceType: body.serviceType,
      pricingType: body.pricingType,
      bookingDate: body.bookingDate,
      startTime: body.startTime,
      estimatedMinutes: body.estimatedMinutes,
      estimatedAcres: body.estimatedAcres,
      estimatedTrips: body.estimatedTrips,
      note: body.note,
    });
    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
