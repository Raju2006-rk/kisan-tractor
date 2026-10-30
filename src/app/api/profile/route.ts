import { NextResponse } from "next/server";
import { updateUserProfile } from "@/lib/booking-service";
import { handleApiError, readJson, requireUser } from "@/lib/http";
import type { Language } from "@/lib/types";

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson<{
      name?: string;
      preferredLanguage?: Language;
      village?: string;
      address?: string;
      serviceRadiusKm?: number;
      lat?: number;
      lng?: number;
      documents?: {
        dlPhoto?: string | null;
        rcNumber?: string | null;
        rcPhoto?: string | null;
      };
    }>(request);
    const updated = await updateUserProfile(user.id, body);
    return NextResponse.json({ user: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
