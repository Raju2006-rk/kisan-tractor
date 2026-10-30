import { NextResponse } from "next/server";
import { getOwnerDashboard } from "@/lib/booking-service";
import { handleApiError, jsonError, requireUser } from "@/lib/http";

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "owner") {
      return jsonError("Only a tractor owner can view this dashboard.", 403);
    }
    const dashboard = await getOwnerDashboard(user.id);
    return NextResponse.json({ dashboard });
  } catch (error) {
    return handleApiError(error);
  }
}
