import { NextResponse } from "next/server";
import { getSessionUser } from "./auth";
import { ServiceError } from "./booking-service";
import type { SessionUser } from "./types";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleApiError(error: unknown) {
  if (error instanceof ServiceError) {
    return jsonError(error.message, error.status);
  }
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return jsonError("Please sign in to continue.", 401);
  }
  console.error(error);
  return jsonError("Something went wrong. Please try again.", 500);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ServiceError("Please sign in to continue.", 401);
  return user;
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ServiceError("Please send valid request data.", 400);
  }
}

export function numberParam(
  value: string | null,
  fallback?: number,
): number | undefined {
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
