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
    const body = await readJson<{ ids?: string[] }>(request).catch(
      () => ({}) as { ids?: string[] },
    );
    await markNotificationsRead(user.id, body.ids);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
