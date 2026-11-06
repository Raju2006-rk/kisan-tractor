import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { BookingsScreen } from "@/components/app/bookings-screen";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bookings" };

export default async function BookingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth");
  return <BookingsScreen role={user.role} />;
}
