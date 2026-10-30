import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ProfileScreen } from "@/components/app/profile-screen";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth");
  return <ProfileScreen user={user} />;
}
