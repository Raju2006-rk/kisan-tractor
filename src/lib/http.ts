import { NextResponse } from "next/server";
import { getSessionUser } from "./auth";
import { ServiceError } from "./booking-service";
import type { SessionUser } from "./types";

const MAX_JSON_BYTES = 64 * 1024;
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export function jsonError(message: string, status = 400) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export function handleApiError(error: unknown) {
  if (error instanceof ServiceError) {
    return jsonError(error.message, error.status);
  }
  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED") {
      return jsonError("Please sign in to continue.", 401);
    }
    console.error("[API Error]:", error);
    const isProd = process.env.NODE_ENV === "production";
    const safeMsg = isProd ? "An error occurred. Please try again." : (error.message || "Something went wrong. Please try again.");
    return jsonError(safeMsg, 400);
  }
  console.error("[Unknown API Error]:", error);
  return jsonError("Something went wrong. Please try again.", 500);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ServiceError("Please sign in to continue.", 401);
  return user;
}

/**
 * Reject keys that can reach Object.prototype when a parsed body is later
 * merged or assigned. JSON.parse creates these as own properties, but a
 * single spread into another object can still poison prototypes in older
 * code paths, so they are refused outright.
 */
function assertNoPrototypePollution(value: unknown, depth = 0): void {
  if (depth > 20 || value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) assertNoPrototypePollution(item, depth + 1);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new ServiceError("Please send valid request data.", 400);
    }
    assertNoPrototypePollution(child, depth + 1);
  }
}

export async function readJson<T>(request: Request): Promise<T> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType && !contentType.includes("application/json")) {
    throw new ServiceError("Please send request data as JSON.", 415);
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    throw new ServiceError("Please send valid request data.", 400);
  }
  if (text.length > MAX_JSON_BYTES) {
    throw new ServiceError("Request data is too large.", 413);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ServiceError("Please send valid request data.", 400);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ServiceError("Please send valid request data.", 400);
  }
  assertNoPrototypePollution(parsed);
  return parsed as T;
}

export function numberParam(
  value: string | null,
  fallback?: number,
): number | undefined {
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Trim and cap free-text values before they reach persistent storage. */
export function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
