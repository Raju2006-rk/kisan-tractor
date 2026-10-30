import { NextResponse } from "next/server";
import {
  performBookingAction,
  type BookingAction,
} from "@/lib/booking-service";
import { handleApiError, jsonError, readJson, requireUser } from "@/lib/http";
import type { PaymentMethod } from "@/lib/types";

const ACTIONS: BookingAction[] = [
  "accept",
  "reject",
  "cancel",
  "start",
  "pause",
  "resume",
  "finish",
  "record_payment",
  "confirm_payment",
  "share_location",
  "dispute",
];

type Body = {
  action?: BookingAction;
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
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await readJson<Body>(request);
    if (!body.action || !ACTIONS.includes(body.action)) {
      return jsonError("Unknown booking action.", 400);
    }
    const booking = await performBookingAction({
      bookingId: id,
      user,
      action: body.action,
      payload: body.payload,
    });
    return NextResponse.json({ booking });
  } catch (error) {
    return handleApiError(error);
  }
}
