import { NextResponse } from "next/server";
import {
  listNotifications,
  markNotificationsRead,
} from "@/lib/booking-service";
import { handleApiError, readJson, requireUser } from "@/lib/http";

export async function GET() {
  try {
    const user = await requireUser();
    const notifications = await listNotifications(user.id);
    return NextResponse.json({
      notifications,
      unread: notifications.filter((n) => !n.read).length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson<{ ids?: unknown }>(request).catch(
      () => ({}) as { ids?: unknown },
    );
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === "string").slice(0, 200)
      : undefined;
    await markNotificationsRead(user.id, ids);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
