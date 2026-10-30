import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  deleteTractor,
  getTractorDetail,
  saveTractor,
} from "@/lib/booking-service";
import { handleApiError, jsonError, readJson, requireUser } from "@/lib/http";

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
      return jsonError("Only a tractor owner can edit a tractor.", 403);
    }
    const { id } = await context.params;
    const body = await readJson<Parameters<typeof saveTractor>[1]>(request);
    const tractor = await saveTractor(user.id, { ...body, id });
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
      return jsonError("Only a tractor owner can remove a tractor.", 403);
    }
    const { id } = await context.params;
    await deleteTractor(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
