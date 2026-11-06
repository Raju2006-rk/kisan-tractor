import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import {
  FarmerDashboard,
  OwnerDashboard,
} from "@/components/app/farmer-dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth");

  return user.role === "owner" ? (
    <OwnerDashboard user={user} />
  ) : (
    <FarmerDashboard user={user} />
  );
}
