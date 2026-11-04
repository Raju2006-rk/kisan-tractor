import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { mutateDb } from "@/lib/db";
import { ensureOwnerProfile, saveTractor, searchTractors } from "@/lib/booking-service";
import { handleApiError, jsonError, numberParam, readJson, requireUser } from "@/lib/http";
import type { PricingType, ServiceType } from "@/lib/types";

const SERVICE_TYPES: ServiceType[] = ["ploughing", "rotavation", "trolley"];
const PRICING_TYPES: PricingType[] = ["hourly", "acre", "trip"];

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    const url = new URL(request.url);
    const serviceParam = url.searchParams.get("service");
    const pricingParam = url.searchParams.get("pricing");
    const ownerParam = url.searchParams.get("owner");
    if (ownerParam === "me" && !user) {
      return jsonError("Please sign in to continue.", 401);
    }
    const service = SERVICE_TYPES.includes(serviceParam as ServiceType)
      ? (serviceParam as ServiceType)
      : undefined;
    const pricing = PRICING_TYPES.includes(pricingParam as PricingType)
      ? (pricingParam as PricingType)
      : undefined;
    const tractors = await searchTractors({
      userId: user?.id,
      lat: numberParam(url.searchParams.get("lat")),
      lng: numberParam(url.searchParams.get("lng")),
      service,
      pricingType: pricing,
      maxDistanceKm: numberParam(url.searchParams.get("distance")),
      query: url.searchParams.get("q") ?? undefined,
      ownerId: ownerParam === "me" ? user?.id : undefined,
    });
    return NextResponse.json({ tractors });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "owner") {
      await mutateDb((db) => {
        const u = db.users.find((item) => item.id === user.id);
        if (u) u.role = "owner";
        ensureOwnerProfile(db, user.id);
      });
    }
    const body = await readJson<Parameters<typeof saveTractor>[1]>(request);
    const tractor = await saveTractor(user.id, body);
    return NextResponse.json({ tractor }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
