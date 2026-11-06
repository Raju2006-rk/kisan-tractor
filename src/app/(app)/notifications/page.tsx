import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { NotificationsScreen } from "@/components/app/notifications-screen";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth");
  return <NotificationsScreen />;
}
