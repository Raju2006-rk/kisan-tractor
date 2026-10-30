import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { OwnerPaymentsScreen } from "@/components/app/owner-payments-screen";

export const metadata = { title: "Payment details" };

export default async function OwnerPaymentsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth");
  if (user.role !== "owner") redirect("/dashboard");
  return <OwnerPaymentsScreen user={user} />;
}
