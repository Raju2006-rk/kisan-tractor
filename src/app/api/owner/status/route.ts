import { NextResponse } from "next/server";
import { refreshSession } from "@/lib/auth";
import { updateOwnerOnlineStatus } from "@/lib/booking-service";
import { handleApiError, jsonError, readJson, requireUser } from "@/lib/http";

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "owner") {
      return jsonError("Only a tractor owner can change availability.", 403);
    }
    const body = await readJson<{ online?: boolean }>(request);
    if (typeof body.online !== "boolean") {
      return jsonError("Please provide an online status.", 400);
    }
    const profile = await updateOwnerOnlineStatus(user.id, body.online);
    await refreshSession(user.id);
    return NextResponse.json({ profile });
  } catch (error) {
    return handleApiError(error);
  }
}
