import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { handleApiError, jsonError, readJson } from "@/lib/http";
import type { Role } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ role?: Role }>(request);
    const role: Role = body.role === "owner" ? "owner" : "farmer";
    const db = await getDb();
    const user =
      role === "owner"
        ? db.users.find((u) => u.id === "usr_ramesh")
        : db.users.find((u) => u.id === "usr_amit");
    if (!user) {
      return jsonError("Demo account is not available. Reset the demo data.", 404);
    }
    await createSession(user.id);
    return NextResponse.json({ ok: true, user });
  } catch (error) {
    return handleApiError(error);
  }
}
