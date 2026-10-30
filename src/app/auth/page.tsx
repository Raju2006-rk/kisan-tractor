import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AuthScreen } from "@/components/auth/auth-screen";
import type { Role } from "@/lib/types";

export const metadata = { title: "Sign in" };

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");
  const params = await searchParams;
  const role: Role = params.role === "owner" ? "owner" : "farmer";
  return <AuthScreen initialRole={role} />;
}
