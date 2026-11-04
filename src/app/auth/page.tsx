import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AuthScreen } from "@/components/auth/auth-screen";
import type { Role, SessionUser } from "@/lib/types";

export const metadata = { title: "Sign in" };
// The page redirects signed-in users, so it must be rendered per request.
export const dynamic = "force-dynamic";

export default async function AuthPage({
  searchParams,
}: {
  searchParams?: Promise<{ role?: string }>;
}) {
  let user: SessionUser | null = null;
  try {
    user = await getSessionUser();
  } catch (err) {
    console.warn("[AuthPage] Failed to get session user:", err);
  }

  if (user) {
    redirect("/dashboard");
  }

  let role: Role = "farmer";
  try {
    const params = searchParams ? await searchParams : undefined;
    if (params?.role === "owner") {
      role = "owner";
    }
  } catch {
    role = "farmer";
  }

  return <AuthScreen initialRole={role} />;
}
