import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getBookingDetail, ServiceError } from "@/lib/booking-service";
import { BookingDetailScreen } from "@/components/app/booking-detail-screen";

export const metadata = { title: "Booking details" };

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/auth");
  const { id } = await params;

  try {
    await getBookingDetail(id, user.id);
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    if (error instanceof ServiceError && error.status === 403) redirect("/bookings");
    throw error;
  }

  return <BookingDetailScreen bookingId={id} role={user.role} />;
}
