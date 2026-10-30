import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { BookingWizard } from "@/components/app/booking-wizard";

export const metadata = { title: "Book a tractor" };

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ tractor?: string; for?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/auth");
  if (user.role !== "farmer") redirect("/dashboard");
  const params = await searchParams;

  return (
    <BookingWizard
      user={user}
      initialTractorId={params.tractor}
      initialForOther={params.for === "other"}
    />
  );
}
