import { NextResponse } from "next/server";
import { getSessionUser, refreshSession } from "@/lib/auth";
import { mutateDb } from "@/lib/db";
import {
  deleteTractor,
  ensureOwnerProfile,
  getTractorDetail,
  saveTractor,
} from "@/lib/booking-service";
import { handleApiError, readJson, requireUser } from "@/lib/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const user = await getSessionUser();
    const tractor = await getTractorDetail(id, user?.id);
    return NextResponse.json({ tractor });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (user.role !== "owner") {
      await mutateDb((db) => {
        const u = db.users.find((item) => item.id === user.id);
        if (u) u.role = "owner";
        ensureOwnerProfile(db, user.id);
      });
    }
    const { id } = await context.params;
    const body = await readJson<Parameters<typeof saveTractor>[1]>(request);
    const tractor = await saveTractor(user.id, { ...body, id });
    // Keep the signed session snapshot in step with profile location edits.
    await refreshSession(user.id);
    return NextResponse.json({ tractor });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    if (user.role !== "owner") {
      await mutateDb((db) => {
        const u = db.users.find((item) => item.id === user.id);
        if (u) u.role = "owner";
      });
    }
    const { id } = await context.params;
    await deleteTractor(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
