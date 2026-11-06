import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { OwnerTractorScreen } from "@/components/app/owner-tractor-screen";

export const dynamic = "force-dynamic";
export const metadata = { title: "My tractor" };

export default async function OwnerTractorPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth");
  if (user.role !== "owner") redirect("/dashboard");
  return <OwnerTractorScreen user={user} />;
}
