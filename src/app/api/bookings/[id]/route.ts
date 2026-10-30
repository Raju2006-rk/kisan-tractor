import { NextResponse } from "next/server";
import { getBookingDetail } from "@/lib/booking-service";
import { handleApiError, requireUser } from "@/lib/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const booking = await getBookingDetail(id, user.id);
    return NextResponse.json({ booking });
  } catch (error) {
    return handleApiError(error);
  }
}
