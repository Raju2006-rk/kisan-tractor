import type { PricingType } from "./types";

export function calculateAmount(
  pricingType: PricingType,
  rate: number,
  quantity: { minutes?: number | null; acres?: number | null; trips?: number | null },
): number {
  switch (pricingType) {
    case "hourly": {
      const minutes = quantity.minutes ?? 0;
      return Math.round((rate * minutes) / 60);
    }
    case "acre": {
      const acres = quantity.acres ?? 0;
      return Math.round(rate * acres);
    }
    case "trip": {
      const trips = quantity.trips ?? 0;
      return Math.round(rate * trips);
    }
  }
}

export function formatRupees(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return `₹${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

export function billFormula(
  pricingType: PricingType,
  rate: number,
  quantity: { minutes?: number | null; acres?: number | null; trips?: number | null },
): string {
  switch (pricingType) {
    case "hourly":
      return `${quantity.minutes ?? 0} min ÷ 60 × ₹${rate}`;
    case "acre":
      return `${quantity.acres ?? 0} acres × ₹${rate}`;
    case "trip":
      return `${quantity.trips ?? 0} trips × ₹${rate}`;
  }
}

export function minutesToHoursLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `${hours} hr${hours > 1 ? "s" : ""}`;
  return `${hours} hr ${rest} min`;
}

export function getQuantityLabel(
  pricingType: PricingType,
  quantity: { minutes?: number | null; acres?: number | null; trips?: number | null },
): string {
  switch (pricingType) {
    case "hourly":
      return `${quantity.minutes ?? 0} minutes`;
    case "acre":
      return `${quantity.acres ?? 0} acres`;
    case "trip":
      return `${quantity.trips ?? 0} trips`;
  }
}
