import { NextResponse } from "next/server";
import { refreshSession } from "@/lib/auth";
import { updateOwnerPaymentDetails } from "@/lib/booking-service";
import { handleApiError, jsonError, readJson, requireUser } from "@/lib/http";
import type { PaymentMethod } from "@/lib/types";

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "owner") {
      return jsonError("Only a tractor owner can update payment details.", 403);
    }
    const body = await readJson<{
      shareUpi?: boolean;
      upiId?: string;
      shareQr?: boolean;
      qrImage?: string;
      shareBank?: boolean;
      bankAccountName?: string;
      bankAccountNumber?: string;
      bankIfsc?: string;
      preferredMethod?: PaymentMethod;
    }>(request);
    const method = body.preferredMethod;
    if (!method || !["upi", "cash", "bank", "other"].includes(method)) {
      return jsonError("Please choose a preferred payment method.", 400);
    }
    const profile = await updateOwnerPaymentDetails(user.id, {
      shareUpi: Boolean(body.shareUpi),
      upiId: body.upiId ?? "",
      shareQr: Boolean(body.shareQr),
      qrImage: body.qrImage ?? "",
      shareBank: Boolean(body.shareBank),
      bankAccountName: body.bankAccountName ?? "",
      bankAccountNumber: body.bankAccountNumber ?? "",
      bankIfsc: body.bankIfsc ?? "",
      preferredMethod: method,
    });
    await refreshSession(user.id);
    return NextResponse.json({ profile });
  } catch (error) {
    return handleApiError(error);
  }
}
